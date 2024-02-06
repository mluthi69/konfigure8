import { useState, useEffect, useCallback } from 'react';
import axios, { AxiosError, AxiosResponse } from 'axios';
//import jwtDecode, { JwtPayload } from 'jwt-decode';
import _ from '@lodash';
import { PartialDeep } from 'type-fest';
import { CognitoUserPool, CognitoUser, AuthenticationDetails } from 'amazon-cognito-identity-js';
import config from './config';

const userPool = new CognitoUserPool({
	UserPoolId: config.UserPoolId,
	ClientId: config.ClientId,
});

const defaultAuthConfig = {
	tokenStorageKey: 'jwt_access_token',
	signInUrl: 'mock-api/auth/sign-in',
	signUpUrl: 'mock-api/auth/sign-up',
	tokenRefreshUrl: 'mock-api/auth/refresh',
	getUserUrl: 'mock-api/auth/user',
	updateUserUrl: 'mock-api/auth/user',
	updateTokenFromHeader: true
};

export type CognitoAuthProps<T> = {
	onSignedIn?: (U: T) => void;
	onSignedUp?: (U: T) => void;
	onSignedOut?: () => void;
	onUpdateUser?: (U: T) => void;
	onError?: (error: any) => void;
};

export type CognitoAuth<User, SignInPayload, SignUpPayload, ConfirmEmailPayload, CogniotUser> = {
	user: User;
	isAuthenticated: boolean;
	isLoading: boolean;
	signIn: (U: SignInPayload) => Promise<{ userData: User; accessToken: string }>;
	completePasswordChallenge: (U: ConfirmEmailPayload) => Promise<{ userData: User; accessToken: string }>;
	signOut: () => void;
	signUp: (U: SignUpPayload) => Promise<AxiosResponse<User, AxiosError>>;
	updateUser: (U: PartialDeep<User>) => void;
	refreshToken: () => void;
	setIsLoading: (isLoading: boolean) => void;
};

const useCognitoAuth = <User, SignInPayload, SignUpPayload, ConfirmEmailPayload, CogniotUser>(
	props: CognitoAuthProps<User>
): CognitoAuth<User, SignInPayload, SignUpPayload, ConfirmEmailPayload, CogniotUser> => {
	const { onSignedIn, onSignedOut, onSignedUp, onError, onUpdateUser } = props;

	// Merge default config with the one from the props
	const authConfig = defaultAuthConfig; //_.defaults(config, defaultAuthConfig);

	const [user, setUser] = useState<User>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isAuthenticated, setIsAuthenticated] = useState(false);

	const setSession = useCallback((accessToken: string) => {
		if (accessToken) {
			localStorage.setItem(authConfig.tokenStorageKey, accessToken);
			axios.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
		}
	}, []);

	const resetSession = useCallback(() => {
		localStorage.removeItem(authConfig.tokenStorageKey);
		delete axios.defaults.headers.common.Authorization;
	}, []);

	const getAccessToken = useCallback(() => {
		return localStorage.getItem(authConfig.tokenStorageKey);
	}, []);

	const handleSignInSuccess = useCallback((userData: User, accessToken: string) => {
		setSession(accessToken);
		setIsAuthenticated(true);
		setUser(userData);
		onSignedIn(userData);
	}, []);

	const handleSignUpSuccess = useCallback((userData: User, accessToken: string) => {
		setSession(accessToken);
		setIsAuthenticated(true);
		setUser(userData);
		onSignedUp(userData);
	}, []);

	const handleSignInFailure = useCallback((error: any) => {
		resetSession();
		setIsAuthenticated(false);
		setUser(null);
		handleError(error);
	}, []);

	const handleSignUpFailure = useCallback((error: any) => {
		resetSession();
		setIsAuthenticated(false);
		setUser(null);
		handleError(error);
	}, []);

	const handleError = useCallback((error: any) => {
		onError(error);
	}, []);

	const isTokenValid = useCallback((accessToken: string) => {
		// if (accessToken) {
		// 	try {
		// 		const decoded = jwtDecode<JwtPayload>(accessToken);
		// 		const currentTime = Date.now() / 1000;
		// 		return decoded.exp > currentTime;
		// 	} catch (error) {
		// 		return false;
		// 	}
		// }
		// return false;
		return true;
	}, []);

	useEffect(() => {
		const attemptAutoLogin = async () => {
			const accessToken = getAccessToken();
			if (isTokenValid(accessToken)) {
				try {
					setIsLoading(true);

					const response: AxiosResponse<User> = await axios.get(authConfig.getUserUrl, {
						headers: { Authorization: `Bearer ${accessToken}` }
					});

					const userData = response?.data;

					handleSignInSuccess(userData, accessToken);

					return true;
				} catch (error) {
					const axiosError = error as AxiosError;

					handleSignInFailure(axiosError);
					return false;
				}
			} else {
				resetSession();
				return false;
			}
		};

		if (!isAuthenticated) {
			attemptAutoLogin().then(() => {
				setIsLoading(false);
			});
		}
	}, [
		isTokenValid,
		setSession,
		handleSignInSuccess,
		handleSignInFailure,
		handleError,
		getAccessToken,
		isAuthenticated
	]);

	const signIn = async (credentials: SignInPayload) => {

		const authenticationDetails = new AuthenticationDetails({
			Username: credentials["email"],
			Password: credentials["password"],
		});

		const cognitoUser = new CognitoUser({
			Username: credentials["email"],
			Pool: userPool,
		});

		return new Promise<{ userData: User; accessToken: string; }>((resolve, reject) => {
			cognitoUser.authenticateUser(authenticationDetails, {
				onSuccess: (result) => {
					const accessToken = result.getIdToken().getJwtToken();
					const payload = result.getIdToken().payload;

					const userData = {
						uid: payload['sub'], // 'sub' is the standard claim for user identifier in JWT
						role: 'admin',//payload['custom:role'], // assuming you have a custom attribute for role
						data: {
							displayName: payload['name'], // or another appropriate attribute
							//photoURL: payload['picture'], // or another appropriate attribute
							email: payload['email'],
							shortcuts: [], // assuming this is not provided by Cognito
							settings: {} // assuming this is not provided by Cognito
						}
					};

					handleSignInSuccess(userData as User, accessToken);
					resolve({ userData: userData as User, accessToken: accessToken });
				},
				newPasswordRequired: function (userAttributes, requiredAttributes) {
					// User was signed up by an admin and must provide new
					// password and required attributes, if any, to complete
					// authentication.

					// the api doesn't accept this field back
					delete userAttributes.email_verified;

					// Call the newPasswordRequired function
					//newPasswordRequired(userAttributes, requiredAttributes);
					reject({ newPasswordRequired: true, userAttributes, requiredAttributes, authenticationDetails });

					// store userAttributes on global variable
					//sessionUserAttributes = userAttributes;
				},
				mfaRequired: function (codeDeliveryDetails) {
					// MFA is required to complete user authentication.
					// Get the code from user and call
					reject({ sendMFACode: true, codeDeliveryDetails });
					//cognitoUser.sendMFACode('123458', this)
				},
				onFailure: (err) => {
					handleSignInFailure(err);
					reject(err);
				},
			});
		});
	};

	const completePasswordChallenge = async (payload: ConfirmEmailPayload) => {
		return new Promise<{ userData: User; accessToken: string; }>((resolve, reject) => {

			//log credentials object to console
			console.log('in complete challenge cognito auth section', payload);

			const authenticationDetails = new AuthenticationDetails({
				Username: payload["updatePasswordPayload"]["authenticationDetails"]["username"],
				Password: payload["updatePasswordPayload"]["authenticationDetails"]["password"]
			});

			console.log('authenticationDetails:', authenticationDetails);

			const cognitoUser = new CognitoUser({
				Username: payload["updatePasswordPayload"]["authenticationDetails"]["username"],
				Pool: userPool,
			});

			cognitoUser.authenticateUser(authenticationDetails, {
				onSuccess: (result) => {
					const accessToken = result.getIdToken().getJwtToken();
					const payload = result.getIdToken().payload;

					const userData = {
						uid: payload['sub'], // 'sub' is the standard claim for user identifier in JWT
						role: 'admin',//payload['custom:role'], // assuming you have a custom attribute for role
						data: {
							displayName: payload['name'], // or another appropriate attribute
							//photoURL: payload['picture'], // or another appropriate attribute
							email: payload['email'],
							shortcuts: [], // assuming this is not provided by Cognito
							settings: {} // assuming this is not provided by Cognito
						}
					};
					handleSignInSuccess(userData as User, accessToken);
					resolve({ userData: userData as User, accessToken: accessToken });
				},
				newPasswordRequired: function (userAttributes, requiredAttributes) {

					// the api doesn't accept this field back
					delete userAttributes.email_verified;
					delete userAttributes.email;

					const newPassword = payload['updatePasswordPayload']['confirmPassword'];
					console.log('newPassword extracted in cognito auth from payload:', newPassword);

					cognitoUser.completeNewPasswordChallenge(newPassword, userAttributes, {
						onSuccess: function (result) {
							// Handle successful password change
							console.log('success from completeNewPasswordChallenge:', result)

							const accessToken = result.getIdToken().getJwtToken();
							const payload = result.getIdToken().payload;

							const userData = {
								uid: payload['sub'], // 'sub' is the standard claim for user identifier in JWT
								role: 'admin',//payload['custom:role'], // assuming you have a custom attribute for role
								data: {
									displayName: payload['name'], // or another appropriate attribute
									//photoURL: payload['picture'], // or another appropriate attribute
									email: payload['email'],
									shortcuts: [], // assuming this is not provided by Cognito
									settings: {} // assuming this is not provided by Cognito
								}
							};
							handleSignInSuccess(userData as User, accessToken);
							resolve({ userData: userData as User, accessToken: accessToken });
						},
						onFailure: function (err) {
							// Handle failed password change
							console.log('error from completeNewPasswordChallenge:', err)
							reject({ newPasswordRequired: true, userAttributes, requiredAttributes, authenticationDetails });
						},
					});
				},
				onFailure: (err) => {
					handleSignInFailure(err);
					reject(err);
				},
			});
		});
	}

	const signUp = useCallback((data: SignUpPayload) => {
		const response = axios.post(authConfig.signUpUrl, data);

		response.then(
			(res: AxiosResponse<{ user: User; access_token: string }>) => {
				const userData = res?.data?.user;
				const accessToken = res?.data?.access_token;

				handleSignUpSuccess(userData, accessToken);

				return userData;
			},
			(error) => {
				const axiosError = error as AxiosError;

				handleSignUpFailure(axiosError);

				return axiosError;
			}
		);

		return response;
	}, []);

	const signOut = useCallback(() => {
		resetSession();

		setIsAuthenticated(false);
		setUser(null);

		onSignedOut();
	}, []);

	const updateUser = useCallback(async (userData: PartialDeep<User>) => {
		try {
			const response: AxiosResponse<User, PartialDeep<User>> = await axios.put(
				authConfig.updateUserUrl,
				userData
			);

			const updatedUserData = response?.data;

			onUpdateUser(updatedUserData);

			return null;
		} catch (error) {
			const axiosError = error as AxiosError;

			handleError(axiosError);
			return axiosError;
		}
	}, []);

	const refreshToken = async () => {
		setIsLoading(true);
		try {
			const response: AxiosResponse<string> = await axios.post(authConfig.tokenRefreshUrl);

			const accessToken = response?.headers?.['New-Access-Token'] as string;

			if (accessToken) {
				setSession(accessToken);
				return accessToken;
			}
			return null;
		} catch (error) {
			const axiosError = error as AxiosError;

			handleError(axiosError);
			return axiosError;
		}
	};

	useEffect(() => {
		if (authConfig.updateTokenFromHeader && isAuthenticated) {
			axios.interceptors.response.use(
				(response) => {
					const newAccessToken = response?.headers?.['New-Access-Token'] as string;

					if (newAccessToken) {
						setSession(newAccessToken);
					}
					return response;
				},
				(error) => {
					const axiosError = error as AxiosError;

					if (axiosError?.response?.status === 401) {
						signOut();
						// eslint-disable-next-line no-console
						console.warn('Unauthorized request. User was signed out.');
					}
					return Promise.reject(axiosError);
				}
			);
		}
	}, [isAuthenticated]);

	return { user, isAuthenticated, isLoading, signIn, signUp, completePasswordChallenge, signOut, updateUser, refreshToken, setIsLoading };
};

export default useCognitoAuth;
