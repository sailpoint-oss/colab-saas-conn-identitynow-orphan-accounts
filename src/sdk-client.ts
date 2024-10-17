import axiosRetry from 'axios-retry'
import { Configuration, Paginator, Search, SearchApi, SourcesApi, Account } from 'sailpoint-api-client'
import {
    AccountsApi,
    AccountsApiDisableAccountRequest,
    AccountsApiEnableAccountRequest,
    AccountsApiGetAccountRequest,
    AccountsApiListAccountsRequest,
    IdentityDocument,
    JsonPatchOperation,
    PublicIdentitiesApi,
} from 'sailpoint-api-client/dist/v3'
import { URL } from 'url'
import { logger } from '@sailpoint/connector-sdk'
import { AxiosError } from 'axios'

const TOKEN_URL_PATH = '/oauth/token'

export class SDKClient {
    private config: Configuration

    constructor(config: any) {
        const tokenUrl = new URL(config.baseurl).origin + TOKEN_URL_PATH
        this.config = new Configuration({ ...config, tokenUrl })
        this.config.retriesConfig = {
            retries: 5,
            // retryDelay: (retryCount) => { return retryCount * 2000; },
            retryDelay: (retryCount, error) =>
                axiosRetry.exponentialDelay(retryCount, error as AxiosError<unknown, any>, 2000),
            retryCondition: (error) => {
                return (
                    axiosRetry.isNetworkError(error as AxiosError<unknown, any>) ||
                    axiosRetry.isRetryableError(error as AxiosError<unknown, any>) ||
                    error.response?.status === 429
                )
            },
            onRetry: (retryCount, error, requestConfig) => {
                logger.debug(
                    `Retrying API [${requestConfig.url}] due to request error: [${error}]. Retry number [${retryCount}]`
                )
                logger.error(error)
            },
        }
    }

    async publicIdentities() {
        const api = new PublicIdentitiesApi(this.config)

        const response = await api.getPublicIdentities()

        return response.data
    }

    async getIdentityByUID(uid: string): Promise<IdentityDocument | undefined> {
        const api = new SearchApi(this.config)

        const search: Search = {
            indices: ['identities'],
            query: {
                query: `attributes.uid.exact:"${uid}"`,
            },
            includeNested: true,
        }

        const response = await api.searchPost({ search, limit: 1 })

        if (response.data.length > 0) {
            return response.data[0] as IdentityDocument
        } else {
            return undefined
        }
    }

    async listIdentitiesBySource(id: string): Promise<IdentityDocument[]> {
        const api = new SearchApi(this.config)
        const search: Search = {
            indices: ['identities'],
            query: {
                query: `@accounts(source.id.exact:"${id}")`,
            },
            includeNested: true,
        }

        const response = await api.searchPost({ search })

        return response.data as IdentityDocument[]
    }

    async listOrphanAccountsBySource(id: string, onlyEnabled: boolean): Promise<Account[]> {
        const api = new AccountsApi(this.config)
        const filters = `sourceId eq "${id}" and uncorrelated eq true`
        const search = async (requestParameters?: AccountsApiListAccountsRequest | undefined) => {
            return await api.listAccounts({ ...requestParameters, filters })
        }

        const response = await Paginator.paginate(api, search)

        return onlyEnabled ? response.data.filter((x) => !x.disabled) : response.data
    }

    async listAccounts(sourceIds?: string[]): Promise<Account[]> {
        const api = new AccountsApi(this.config)
        let filters: string | undefined
        if (sourceIds) {
            const sourceValues = sourceIds.map((x) => `"${x}"`).join(', ')
            filters = `sourceId in (${sourceValues})`
        }
        const search = async (requestParameters?: AccountsApiListAccountsRequest | undefined) => {
            return await api.listAccounts({ ...requestParameters, filters })
        }

        const response = await Paginator.paginate(api, search)

        return response.data
    }

    async enableAccount(id: string) {
        const api = new AccountsApi(this.config)

        const requestParameters: AccountsApiEnableAccountRequest = {
            id,
            accountToggleRequest: {
                forceProvisioning: true,
            },
        }
        await api.enableAccount(requestParameters)
    }

    async disableAccount(id: string) {
        const api = new AccountsApi(this.config)

        const requestParameters: AccountsApiDisableAccountRequest = {
            id,
            accountToggleRequest: {
                forceProvisioning: true,
            },
        }
        await api.disableAccount(requestParameters)
    }

    async getAccount(id: string): Promise<Account | undefined> {
        const api = new AccountsApi(this.config)
        const requestParameters: AccountsApiGetAccountRequest = { id }

        try {
            const response = await api.getAccount(requestParameters)
            return response.data
        } catch (e) {
            return undefined
        }
    }

    async listSources() {
        const api = new SourcesApi(this.config)

        const response = await Paginator.paginate(api, api.listSources)

        return response.data
    }

    async correlateAccount(identityId: string, id: string): Promise<object> {
        const api = new AccountsApi(this.config)
        const requestBody: Array<object> = [
            {
                op: 'replace',
                path: '/identityId',
                value: identityId,
            },
        ]
        const response = await api.updateAccount({ id, requestBody })

        return response.data
    }
}
