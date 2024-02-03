import { FuseRouteConfigType } from '@fuse/utils/FuseUtils';
//import SignInPage from './SignInPage';
import ModernSignInPage from './ModernSignInPage';
import authRoles from '../../auth/authRoles';

const SignInConfig: FuseRouteConfigType = {
	settings: {
		layout: {
			config: {
				navbar: {
					display: false
				},
				toolbar: {
					display: false
				},
				footer: {
					display: false
				},
				leftSidePanel: {
					display: false
				},
				rightSidePanel: {
					display: false
				}
			}
		}
	},
	auth: authRoles.onlyGuest,
	routes: [
		{
			path: 'sign-in',
			element: <ModernSignInPage />
		}
	]
};

export default SignInConfig;