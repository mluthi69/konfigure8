#!/bin/bash -e

REGION='ap-southeast-2'
echo "Region: $REGION"
ADMIN_SITE_URL=$(aws cloudformation describe-stacks --region ap-southeast-2 --query "Stacks[].Outputs[?OutputKey=='AdminAppSite'].OutputValue" --output text)
echo "Admin site URL: $ADMIN_SITE_URL"
ADMIN_SITE_BUCKET=$(aws cloudformation describe-stacks --region ap-southeast-2 --query "Stacks[].Outputs[?OutputKey=='AdminBucket'].OutputValue" --output text)
echo "Admin site bucket: $ADMIN_SITE_BUCKET"

APP_SITE_URL=$(aws cloudformation describe-stacks --region ap-southeast-2 --query "Stacks[].Outputs[?OutputKey=='ApplicationSite'].OutputValue" --output text)
echo "Application site URL: $APP_SITE_URL"
APP_SITE_BUCKET=$(aws cloudformation describe-stacks --region ap-southeast-2 --query "Stacks[].Outputs[?OutputKey=='AppBucket'].OutputValue" --output text)
echo "Application site bucket: $APP_SITE_BUCKET"

LANDING_APP_SITE_URL=$(aws cloudformation describe-stacks --region ap-southeast-2 --query "Stacks[].Outputs[?OutputKey=='LandingApplicationSite'].OutputValue" --output text)
echo "Landing application site URL: $LANDING_APP_SITE_URL"
LANDING_APP_SITE_BUCKET=$(aws cloudformation describe-stacks --region ap-southeast-2 --query "Stacks[].Outputs[?OutputKey=='LandingAppBucket'].OutputValue" --output text)
echo "Landing application site bucket: $LANDING_APP_SITE_BUCKET"

ADMIN_APPCLIENTID=$(aws cloudformation describe-stacks --region ap-southeast-2 --query "Stacks[].Outputs[?OutputKey=='CognitoUserPoolClientId'].OutputValue" --output text)
echo "Admin App Client ID: $ADMIN_APPCLIENTID"
ADMIN_USERPOOLID=$(aws cloudformation describe-stacks --region ap-southeast-2 --query "Stacks[].Outputs[?OutputKey=='CognitoUserPoolId'].OutputValue" --output text)
echo "Admin User Pool ID: $ADMIN_USERPOOLID"

#ADMIN_APIGATEWAYURL=$(aws cloudformation describe-stacks --region ap-southeast-2 --query "Stacks[].Outputs[?OutputKey=='????'].OutputValue" --output text)
ADMIN_APIGATEWAYURL='xyz.com'
echo  "Admin API Gateway URL: $ADMIN_APIGATEWAYURL"

# Configuring admin UI
echo "aws s3 ls s3://${ADMIN_SITE_BUCKET}"
if ! aws s3 ls "s3://${ADMIN_SITE_BUCKET}"; then
  echo "Error! S3 Bucket: $ADMIN_SITE_BUCKET not readable"
  exit 1
else
  echo "S3 Bucket Check: $ADMIN_SITE_BUCKET is readable"
fi

#cd ../

CURRENT_DIR=$(pwd)
echo "Current Dir: $CURRENT_DIR"

cd k8-frontends/admin || exit # stop execution if cd fails

echo "Configuring environment for Admin Client"
cat <<EoF >./src/environments/environment.js
export const environment = {
  production: true,
  apiUrl: '$ADMIN_APIGATEWAYURL',
};

EoF
cat <<EoF >./src/environments/environment.ts
export const environment = {
  production: false,
  apiUrl: '$ADMIN_APIGATEWAYURL',
};
EoF

cat <<EoF >./src/aws-exports.ts
const awsmobile = {
    "aws_project_region": "$REGION",
    "aws_cognito_region": "$REGION",
    "aws_user_pools_id": "$ADMIN_USERPOOLID",
    "aws_user_pools_web_client_id": "$ADMIN_APPCLIENTID",
};

export default awsmobile;
EoF

yarn install && yarn build
# npm install --legacy-peer-deps && npm run build

echo "aws s3 sync --delete --cache-control no-store dist s3://${ADMIN_SITE_BUCKET}"
aws s3 sync --delete --cache-control no-store dist "s3://${ADMIN_SITE_BUCKET}"

if [[ $? -ne 0 ]]; then
  exit 1
fi

echo "Completed configuring environment for Admin Client"

# Configuring application UI
echo "aws s3 ls s3://${APP_SITE_BUCKET}"
if ! aws s3 ls "s3://${APP_SITE_BUCKET}"; then
  echo "Error! S3 Bucket: $APP_SITE_BUCKET not readable"
  exit 1
fi

cd ../

CURRENT_DIR=$(pwd)
echo "Current Dir: $CURRENT_DIR"

cd application || exit # stop execution if cd fails

echo "Configuring environment for App Client"

cat <<EoF >./src/environments/environment.prod.ts
export const environment = {
  production: true,
  regApiGatewayUrl: '$ADMIN_APIGATEWAYURL',
};
EoF

cat <<EoF >./src/environments/environment.ts
export const environment = {
  production: true,
  regApiGatewayUrl: '$ADMIN_APIGATEWAYURL',
};
EoF

yarn install && yarn build
# npm install --legacy-peer-deps && npm run build

echo "aws s3 sync --delete --cache-control no-store dist s3://${APP_SITE_BUCKET}"
aws s3 sync --delete --cache-control no-store dist "s3://${APP_SITE_BUCKET}"

if [[ $? -ne 0 ]]; then
  exit 1
fi

echo "Completed configuring environment for App Client"

# Configuring landing UI

echo "aws s3 ls s3://${LANDING_APP_SITE_BUCKET}"
if ! aws s3 ls "s3://${LANDING_APP_SITE_BUCKET}"; then
  echo "Error! S3 Bucket: $LANDING_APP_SITE_BUCKET not readable"
  exit 1
fi

cd ../

CURRENT_DIR=$(pwd)
echo "Current Dir: $CURRENT_DIR"

cd landing || exit # stop execution if cd fails

echo "Configuring environment for Landing Client"

cat <<EoF >./src/environments/environment.prod.ts
export const environment = {
  production: true,
  apiGatewayUrl: '$ADMIN_APIGATEWAYURL'
};
EoF

cat <<EoF >./src/environments/environment.ts
export const environment = {
  production: false,
  apiGatewayUrl: '$ADMIN_APIGATEWAYURL'
};
EoF

yarn install && yarn build
# npm install --legacy-peer-deps && npm run build

echo "aws s3 sync --delete --cache-control no-store dist s3://${LANDING_APP_SITE_BUCKET}"
aws s3 sync --delete --cache-control no-store dist "s3://${LANDING_APP_SITE_BUCKET}"

if [[ $? -ne 0 ]]; then
  exit 1
fi

cd ../..

echo "Completed configuring environment for Landing Client"

echo "Admin site URL: https://$ADMIN_SITE_URL"
echo "Application site URL: https://$APP_SITE_URL"
echo "Landing site URL: https://$LANDING_APP_SITE_URL"
echo "Successfully completed deployment"
