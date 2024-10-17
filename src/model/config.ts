export interface Config {
    baseurl: string
    clientId: string
    clientSecret: string
    spConnectorInstanceId: string
    spConnectorSpecId: string
    spConnectorSupportsCustomSchemas: boolean
    sources: string[]
    onlyEnabled: boolean
}
