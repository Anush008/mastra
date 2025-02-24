import { Integration, OpenAPI, IntegrationCredentialType, IntegrationAuth } from '@mastra/core';
import { createClient, type OASClient, type NormalizeOAS } from 'fets';

// @ts-ignore
import DocusignLogo from './assets/docusign.png';
import { openapi } from './openapi';
import { components } from './openapi-components';
import { paths } from './openapi-paths';

type DocusignConfig = {
  CLIENT_ID: string;
  CLIENT_SECRET: string;

  [key: string]: any;
};

export class DocusignIntegration extends Integration {
  constructor({ config }: { config: DocusignConfig }) {
    super({
      ...config,
      authType: IntegrationCredentialType.OAUTH,
      name: 'DOCUSIGN',
      logoUrl: DocusignLogo,
    });
  }

  getOpenApiSpec() {
    return { paths, components } as unknown as OpenAPI;
  }

  getApiClient = async ({ connectionId }: { connectionId: string }): Promise<OASClient<NormalizeOAS<openapi>>> => {
    const connection = await this.dataLayer?.getConnection({ name: this.name, connectionId });

    if (!connection) {
      throw new Error(`Connection not found for connectionId: ${connectionId}`);
    }

    const authenticator = this.getAuthenticator();
    const { accessToken } = await authenticator.getAuthToken({ k_id: connection.id });

    const client = createClient<NormalizeOAS<openapi>>({
      endpoint: 'https://www.docusign.net/restapi',
      globalParams: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    });

    return client as any;
  };

  registerEvents() {
    this.events = {};
    return this.events;
  }

  getAuthenticator() {
    return new IntegrationAuth({
      dataAccess: this.dataLayer!,
      // @ts-ignore
      onConnectionCreated: () => {
        // TODO
      },
      config: {
        INTEGRATION_NAME: this.name,
        AUTH_TYPE: this.config.authType,
        CLIENT_ID: this.config.CLIENT_ID,
        CLIENT_SECRET: this.config.CLIENT_SECRET,
        REDIRECT_URI: this.config.REDIRECT_URI || this.corePresets.redirectURI,
        SERVER: `https://www.docusign.net`,
        AUTHORIZATION_ENDPOINT: `https://account.docusign.com/oauth/auth`,
        TOKEN_ENDPOINT: `https://account.docusign.com/oauth/token`,
        SCOPES: [],
      },
    });
  }
}
