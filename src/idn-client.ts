import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'

export class IDNClient {
    private readonly idnUrl: string
    private readonly patId: string
    private readonly patSecret: string
    private readonly includedSources: string[]
    readonly application: string | null
    private accessToken?: string
    private expiryDate: Date
    private readonly LIMIT = 250

    constructor(config: any) {
        this.idnUrl = config.idnUrl
        this.patId = config.patId
        this.patSecret = config.patSecret
        this.expiryDate = new Date()
        this.includedSources = config.includedSources || []
        this.application = config.application
    }

    async getAccessToken(): Promise<string | undefined> {
        if (new Date() >= this.expiryDate) {
            const request: AxiosRequestConfig = {
                method: 'post',
                baseURL: this.idnUrl,
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                params: {
                    client_id: this.patId,
                    client_secret: this.patSecret,
                    grant_type: 'client_credentials',
                },
                url: '/oauth/token',
            }
            const response: AxiosResponse = await axios(request)
            this.accessToken = response.data.access_token
            this.expiryDate = new Date()
            this.expiryDate.setSeconds(this.expiryDate.getSeconds() + response.data.expires_in)
        }

        return this.accessToken
    }

    async testConnection(): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()
        const url = '/beta/public-identities-config'

        const request: AxiosRequestConfig = {
            method: 'get',
            baseURL: this.idnUrl,
            url,
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        }

        return axios(request)
    }

    private async getIncludedSourcesQuery(): Promise<string> {
        const accessToken = await this.getAccessToken()
        const url = '/v3/sources'
        const query = this.includedSources.map((x) => `name eq "${x}"`).join(' or ')

        const request: AxiosRequestConfig = {
            method: 'get',
            baseURL: this.idnUrl,
            url,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: 'application/json',
            },
            params: {
                filters: query,
                limit: this.LIMIT,
                offset: 0,
            },
        }

        const response = await axios(request)

        return response.data.map((x: any) => `sourceId eq "${x.id}"`).join(' or ')
    }

    async collectOrphanAccounts(): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()
        const url = '/beta/accounts'
        const sourcesQuery = await this.getIncludedSourcesQuery()

        const request: AxiosRequestConfig = {
            method: 'get',
            baseURL: this.idnUrl,
            url,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            params: {
                filters: `uncorrelated eq true and (${sourcesQuery})`,
                count: true,
                limit: this.LIMIT,
                offset: 0,
            },
        }

        let data: any[] = []
        let finished = false

        let response = await axios(request)

        while (!finished) {
            if (this.LIMIT + request.params.offset < parseInt(response.headers['x-total-count'])) {
                request.params.offset += this.LIMIT
                response = await axios(request)
                data = [...data, ...response.data]
                response.data = data
            } else {
                finished = true
            }
        }

        return response
    }

    async getEntitlements(filters: string): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()
        const url = '/beta/entitlements'
        const sourcesQuery = await this.getIncludedSourcesQuery()

        const request: AxiosRequestConfig = {
            method: 'get',
            baseURL: this.idnUrl,
            url,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            params: {
                filters,
                count: true,
                limit: this.LIMIT,
                offset: 0,
            },
        }

        let data: any[] = []
        let finished = false

        let response = await axios(request)

        while (!finished) {
            if (this.LIMIT + request.params.offset < parseInt(response.headers['x-total-count'])) {
                request.params.offset += this.LIMIT
                response = await axios(request)
                data = [...data, ...response.data]
                response.data = data
            } else {
                finished = true
            }
        }

        return response
    }

    async makeEntitlementRequestable(id: string): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()
        const url: string = `/beta/entitlements/${id}`

        let request: AxiosRequestConfig = {
            method: 'patch',
            baseURL: this.idnUrl,
            url,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json-patch+json',
                Accept: 'application/json',
            },
            data: [
                {
                    op: 'replace',
                    path: '/requestable',
                    value: true,
                },
            ],
        }

        return await axios(request)
    }

    async getAccount(id: string): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()
        const url = `/beta/accounts/${id}`

        const request: AxiosRequestConfig = {
            method: 'get',
            baseURL: this.idnUrl,
            url,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        }

        return await axios(request)
    }

    async getIdentity(name: string): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()
        const url = '/v3/search'

        const request: AxiosRequestConfig = {
            method: 'post',
            baseURL: this.idnUrl,
            url,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            params: {
                limit: 1,
            },
            data: {
                query: {
                    query: `name.exact:"${name}"`,
                },
                indices: ['identities'],
                includeNested: false,
                queryResultFilter: {
                    includes: ['id'],
                },
            },
        }

        return await axios(request)
    }

    async correlateAccount(id: string, account: string): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()
        const url = `/beta/accounts/${account}`

        const request: AxiosRequestConfig = {
            method: 'patch',
            baseURL: this.idnUrl,
            url,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json-patch+json',
                Accept: 'application/json',
            },
            data: [
                {
                    op: 'replace',
                    path: '/identityId',
                    value: id,
                },
            ],
        }

        return await axios(request)
    }

    async enableAccount(id: string): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()
        const url = `/beta/accounts/${id}/enable`

        const request: AxiosRequestConfig = {
            method: 'post',
            baseURL: this.idnUrl,
            url,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            data: {
                forceProvisioning: true,
            },
        }

        return await axios(request)
    }

    async disableAccount(id: string): Promise<AxiosResponse> {
        const accessToken = await this.getAccessToken()
        const url = `/beta/accounts/${id}/disable`

        const request: AxiosRequestConfig = {
            method: 'post',
            baseURL: this.idnUrl,
            url,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            data: {
                forceProvisioning: true,
            },
        }

        return await axios(request)
    }
}
