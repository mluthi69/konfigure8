import { FuseRouteConfigType } from '@fuse/utils/FuseUtils';
import ResetPasswordPage from './ResetPasswordPage';
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
			path: 'reset-password',
			element: <ResetPasswordPage />
		}
	]
};

export default SignInConfig;
