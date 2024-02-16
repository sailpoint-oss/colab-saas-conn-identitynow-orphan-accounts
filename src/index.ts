import { AxiosResponse } from 'axios'
import {
    Context,
    ConnectorError,
    createConnector,
    readConfig,
    logger,
    Response,
    StdAccountCreateInput,
    StdAccountCreateOutput,
    StdAccountListInput,
    StdAccountListOutput,
    StdAccountReadInput,
    StdAccountReadOutput,
    StdAccountUpdateInput,
    StdAccountUpdateOutput,
    StdEntitlementListOutput,
    StdEntitlementReadOutput,
    StdEntitlementReadInput,
    StdTestConnectionOutput,
    AttributeChangeOp,
} from '@sailpoint/connector-sdk'
import { IDNClient } from './idn-client'
import { Account } from './model/account'
import { Group } from './model/group'

// Connector must be exported as module property named connector
export const connector = async () => {
    // Get connector source config
    const config = await readConfig()

    // Use the vendor SDK, or implement own client as necessary, to initialize a client
    const client = new IDNClient(config)

    const SLEEP = 5 * 1000

    function sleep(ms: number) {
        return new Promise((resolve) => setTimeout(resolve, ms))
    }

    const buildSimpleAccount = (id: string, name: string): Account => {
        const account: Account = {
            identity: id,
            uuid: name,
            attributes: { id, name },
        }

        return account
    }

    const makeGroupsRequestable = async (groups: Group[]): Promise<void> => {
        await sleep(SLEEP)
        const filters = 'value in (' + groups.map(({ identity }) => `"${identity}"`).join(',') + ')'
        const response1 = await client.getEntitlements(filters)
        for (const { id } of response1.data) {
            const response2 = await client.makeEntitlementRequestable(id)
        }
    }

    return createConnector()
        .stdTestConnection(async (context: Context, input: undefined, res: Response<StdTestConnectionOutput>) => {
            const response: AxiosResponse = await client.testConnection()
            if (response.status != 200) {
                throw new ConnectorError('Unable to connect to IdentityNow')
            } else {
                res.send({})
            }
        })
        .stdAccountList(async (context: Context, input: StdAccountListInput, res: Response<StdAccountListOutput>) => {
            if (config.enableOrphanIdentities) {
                const response: AxiosResponse = await client.collectOrphanAccounts()
                for (const acc of response.data) {
                    const account: Account = new Account(acc)

                    logger.info(account)
                    res.send(account)
                }
            } else {
                logger.info('Orphan identities disabled, skipping account aggregation...')
            }
        })
        .stdAccountRead(async (context: Context, input: StdAccountReadInput, res: Response<StdAccountReadOutput>) => {
            logger.info(input)
            const response = await client.getAccount(input.identity)
            const account: Account = new Account(response.data)

            res.send(account)
        })
        .stdAccountCreate(
            async (context: Context, input: StdAccountCreateInput, res: Response<StdAccountCreateOutput>) => {
                logger.info(input)
                const response = await client.getIdentity(input.attributes.name)
                const id = response.data[0].id
                await client.correlateAccount(id, input.attributes.id)
                const account = buildSimpleAccount(input.attributes.id, input.attributes.name)

                logger.info(account)
                res.send(account)
            }
        )
        .stdAccountUpdate(
            async (context: Context, input: StdAccountUpdateInput, res: Response<StdAccountUpdateOutput>) => {
                logger.info(input)
                const response1 = await client.getAccount(input.identity)
                let account: Account = new Account(response1.data)
                for (let change of input.changes) {
                    const values = [].concat(change.value)
                    for (let value of values) {
                        switch (change.op) {
                            case AttributeChangeOp.Add:
                                console.log('Skipping entitlement add request for orphan account')
                                break
                            case AttributeChangeOp.Remove:
                                await client.disableAccount(value)
                                break
                            default:
                                throw new ConnectorError(`Operation not supported: ${change.op}`)
                        }
                    }
                }
                const response2 = await client.getAccount(input.identity)
                account = new Account(response2.data)

                logger.info(account)
                res.send(account)
            }
        )
        .stdAccountDisable(async (context: Context, input: any, res: Response<any>) => {
            logger.info(input)
            await client.disableAccount(input.identity)
            const response = await client.getAccount(input.identity)
            const account = new Account(response.data)

            logger.info(account)
            res.send(account)
        })
        .stdAccountEnable(async (context: Context, input: any, res: Response<any>) => {
            logger.info(input)
            await client.enableAccount(input.identity)
            const response = await client.getAccount(input.identity)
            const account = new Account(response.data)

            logger.info(account)
            res.send(account)
        })
        .stdEntitlementList(async (context: Context, input: any, res: Response<StdEntitlementListOutput>) => {
            const response = await client.collectOrphanAccounts()
            const accessProfiles: string[] = []
            const groups: Group[] = []
            for (const gr of response.data) {
                const group: Group = new Group(gr)
                groups.push(group)

                logger.info(group)
                res.send(group)
            }
            if (config.makeEntitlementsRequestable) {
                makeGroupsRequestable(groups)
            }
        })
        .stdEntitlementRead(
            async (context: Context, input: StdEntitlementReadInput, res: Response<StdEntitlementReadOutput>) => {
                logger.info(input)
                const response: AxiosResponse = await client.getAccount(input.identity)
                const group: Group = new Group(response.data)

                logger.info(group)
                res.send(group)
            }
        )
}
