import React, { createContext, useCallback, useContext, useMemo } from 'react';
import FuseAuthorization from '@fuse/core/FuseAuthorization';
import { useAppDispatch } from 'app/store/store';
import FuseSplashScreen from '@fuse/core/FuseSplashScreen/FuseSplashScreen';
import {
	resetUser,
	selectUser,
	selectUserRole,
	setUser,
	updateUser,
	userSlice
} from 'src/app/auth/user/store/userSlice';
import BrowserRouter from '@fuse/core/BrowserRouter';
import { PartialDeep } from 'type-fest';
import _ from '@lodash';
import { useSelector } from 'react-redux';
import withReducer from 'app/store/withReducer';
import useJwtAuth, { JwtAuth } from './services/jwt/useJwtAuth';
import useCognitoAuth, {CognitoAuth} from './services/cognito/useCognitoAuth';
import { User } from './user';

export type SignInPayload = {
	email: string;
	password: string;
};

export type SignUpPayload = {
	displayName: string;
	password: string;
	email: string;
};

type AuthContext = {
	jwtService?: JwtAuth<User, SignInPayload, SignUpPayload>;
	cognitoService?: CognitoAuth<User, SignInPayload, SignUpPayload>;
	//firebaseService?: ReturnType<typeof useFirebaseAuth>;
	signOut?: () => void;
	updateUser?: (U: PartialDeep<User>) => void;
	isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContext>({
	isAuthenticated: false
});

type AuthProviderProps = { children: React.ReactNode };

function AuthRoute(props: AuthProviderProps) {
	const { children } = props;
	const dispatch = useAppDispatch();
	const user = useSelector(selectUser);
	
	/**
	 * Get user role from store
	 */
	const userRole = useSelector(selectUserRole);

	const jwtService = useJwtAuth({
		config: {
			tokenStorageKey: 'jwt_access_token',
			signInUrl: 'mock-api/auth/sign-in',
			signUpUrl: 'mock-api/auth/sign-up',
			tokenRefreshUrl: 'mock-api/auth/refresh',
			getUserUrl: 'mock-api/auth/user',
			updateUserUrl: 'mock-api/auth/user',
			updateTokenFromHeader: true
		},
		onSignedIn: (user: User) => {
			dispatch(setUser(user));
			setAuthService('jwt');
		},
		onSignedUp: (user: User) => {
			dispatch(setUser(user));
			setAuthService('jwt');
		},
		onSignedOut: () => {
			dispatch(resetUser());
			resetAuthService();
		},
		onUpdateUser: (user) => {
			dispatch(updateUser(user));
		},
		onError: (error) => {
			// eslint-disable-next-line no-console
			console.warn(error);
		}
	});

	const cognitoService = useCognitoAuth({
		onSignedIn: (user: User) => {
			dispatch(setUser(user));
			setAuthService('cognito');
		},
		onSignedUp: (user: User) => {
			dispatch(setUser(user));
			setAuthService('cognito');
		},
		onSignedOut: () => {
			dispatch(resetUser());
			resetAuthService();
		},
		onUpdateUser: (user) => {
			dispatch(updateUser(user));
		},
		onError: (error) => {
			// eslint-disable-next-line no-console
			console.log(error);
		}
	});

	const isLoading = useMemo(
		() => jwtService?.isLoading || cognitoService?.isLoading,
		[jwtService?.isLoading, cognitoService?.isLoading]
	);

	const isAuthenticated = useMemo(
		() => jwtService?.isAuthenticated || cognitoService?.isAuthenticated,
		[jwtService?.isAuthenticated, cognitoService?.isAuthenticated]
	);

	const combinedAuth = useMemo<AuthContext>(
		() => ({
			jwtService,
			cognitoService,
			signOut: () => {
				const authService = getAuthService();

				if (authService === 'jwt') {
					return jwtService?.signOut();
				}

				if (authService === 'cognito') {
					return cognitoService?.signOut();
				}

				return null;
			},
			updateUser: (userData) => {
				const authService = getAuthService();

				if (authService === 'jwt') {
					return jwtService?.updateUser(userData);
				}

				if(authService === 'cognito') {
					return cognitoService?.updateUser(userData);
				}

				return null;
			},
			isAuthenticated
		}),
		[isAuthenticated, user]
	);

	const getAuthService = useCallback(() => {
		return localStorage.getItem('authService');
	}, []);

	const setAuthService = useCallback((authService: string) => {
		if (authService) {
			localStorage.setItem('authService', authService);
		}
	}, []);

	const resetAuthService = useCallback(() => {
		localStorage.removeItem('authService');
	}, []);

	if (isLoading) {
		return <FuseSplashScreen />;
	}

	return (
		<AuthContext.Provider value={combinedAuth}>
			<BrowserRouter>
				<FuseAuthorization userRole={userRole}>{children}</FuseAuthorization>
			</BrowserRouter>
		</AuthContext.Provider>
	);
}

function useAuth(): AuthContext {
	const context = useContext(AuthContext);
	if (!context) {
		throw new Error('useAuth must be used within a AuthRouteProvider');
	}
	return context;
}
const AuthRouteProvider = withReducer<AuthProviderProps>('user', userSlice.reducer)(AuthRoute);

export { useAuth, AuthRouteProvider };
