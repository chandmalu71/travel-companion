/**
 * AWS Cognito service for user authentication operations.
 * Wraps the AWS SDK Cognito Identity Provider client.
 */

import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  InitiateAuthCommand,
  ForgotPasswordCommand,
  type AuthenticationResultType,
} from '@aws-sdk/client-cognito-identity-provider';

export interface CognitoConfig {
  userPoolId: string;
  clientId: string;
  region: string;
}

export interface SignUpResult {
  userSub: string;
  userConfirmed: boolean;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;
}

/**
 * Service that wraps AWS Cognito user pool operations.
 */
export class CognitoService {
  private client: CognitoIdentityProviderClient;
  private clientId: string;

  constructor(config: CognitoConfig) {
    this.client = new CognitoIdentityProviderClient({
      region: config.region,
    });
    this.clientId = config.clientId;
  }

  /**
   * Register a new user in Cognito.
   * Cognito sends the verification email automatically.
   */
  async signUp(email: string, password: string): Promise<SignUpResult> {
    const command = new SignUpCommand({
      ClientId: this.clientId,
      Username: email,
      Password: password,
      UserAttributes: [
        { Name: 'email', Value: email },
      ],
    });

    const response = await this.client.send(command);

    return {
      userSub: response.UserSub ?? '',
      userConfirmed: response.UserConfirmed ?? false,
    };
  }

  /**
   * Authenticate a user with email and password.
   * Returns tokens on success.
   */
  async initiateAuth(email: string, password: string): Promise<AuthResult> {
    const command = new InitiateAuthCommand({
      ClientId: this.clientId,
      AuthFlow: 'USER_PASSWORD_AUTH',
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    });

    const response = await this.client.send(command);
    const authResult = response.AuthenticationResult as AuthenticationResultType;

    if (!authResult?.AccessToken || !authResult?.RefreshToken || !authResult?.IdToken) {
      throw new Error('Authentication failed: incomplete token response');
    }

    return {
      accessToken: authResult.AccessToken,
      refreshToken: authResult.RefreshToken,
      idToken: authResult.IdToken,
      expiresIn: authResult.ExpiresIn ?? 3600,
    };
  }

  /**
   * Refresh authentication tokens using a refresh token.
   */
  async refreshAuth(refreshToken: string): Promise<AuthResult> {
    const command = new InitiateAuthCommand({
      ClientId: this.clientId,
      AuthFlow: 'REFRESH_TOKEN_AUTH',
      AuthParameters: {
        REFRESH_TOKEN: refreshToken,
      },
    });

    const response = await this.client.send(command);
    const authResult = response.AuthenticationResult as AuthenticationResultType;

    if (!authResult?.AccessToken || !authResult?.IdToken) {
      throw new Error('Token refresh failed: incomplete token response');
    }

    return {
      accessToken: authResult.AccessToken,
      // Refresh token is not rotated by Cognito on refresh, so return the original
      refreshToken: refreshToken,
      idToken: authResult.IdToken,
      expiresIn: authResult.ExpiresIn ?? 3600,
    };
  }

  /**
   * Initiate a password reset flow. Sends code to email.
   */
  async forgotPassword(email: string): Promise<void> {
    const command = new ForgotPasswordCommand({
      ClientId: this.clientId,
      Username: email,
    });

    await this.client.send(command);
  }
}

/**
 * Create a CognitoService instance from environment config.
 */
export function createCognitoService(config: CognitoConfig): CognitoService {
  return new CognitoService(config);
}
