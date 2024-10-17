import {
    Context,
    ConnectorError,
    createConnector,
    readConfig,
    logger,
    Response,
    StdAccountCreateInput,
    StdAccountCreateOutput,
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
    StdTestConnectionInput,
    StdAccountListInput,
} from '@sailpoint/connector-sdk'
import { OrphanAccount } from './model/account'
import { Group } from './model/group'
import { SDKClient } from './sdk-client'
import { Config } from './model/config'

// Connector must be exported as module property named connector
export const connector = async () => {
    // Get connector source config
    const config: Config = await readConfig()

    // Use the vendor SDK, or implement own client as necessary, to initialize a client
    const client = new SDKClient(config)

    return createConnector()
        .stdTestConnection(
            async (context: Context, input: StdTestConnectionInput, res: Response<StdTestConnectionOutput>) => {
                try {
                    const response = await client.publicIdentities()
                    res.send({})
                } catch (e) {
                    throw new ConnectorError('Unable to connect to Identity Security Cloud')
                }
            }
        )
        .stdAccountList(async (context: Context, input: StdAccountListInput, res: Response<StdAccountListOutput>) => {
            const sources = await client.listSources()
            const includedSources = sources.filter((x) => config.sources.includes(x.name))
            for (const source of includedSources) {
                const accounts = await client.listOrphanAccountsBySource(source.id!, config.onlyEnabled)
                for (const acc of accounts) {
                    const account = new OrphanAccount(acc)
                    logger.info({ account })
                    res.send(account)
                }
            }
        })
        .stdAccountCreate(
            async (context: Context, input: StdAccountCreateInput, res: Response<StdAccountCreateOutput>) => {
                logger.info({ input })

                const identity = await client.getIdentityByUID(input.attributes.name)
                await client.correlateAccount(identity!.id, input.identity!)
                const sourceAccount = await client.getAccount(input.identity!)
                const account = new OrphanAccount(sourceAccount!)

                logger.info({ account })
                res.send(account)
            }
        )
        .stdAccountRead(async (context: Context, input: StdAccountReadInput, res: Response<StdAccountReadOutput>) => {
            logger.info({ input })

            const sourceAccount = await client.getAccount(input.identity!)
            const account = new OrphanAccount(sourceAccount!)

            logger.info({ account })
            res.send(account)
        })
        .stdAccountDisable(async (context: Context, input: any, res: Response<any>) => {
            logger.info({ input })

            await client.disableAccount(input.identity)
            const sourceAccount = await client.getAccount(input.identity!)
            const account = new OrphanAccount(sourceAccount!)

            logger.info({ account })
            res.send(account)
        })
        .stdAccountEnable(async (context: Context, input: any, res: Response<any>) => {
            logger.info({ input })

            await client.disableAccount(input.identity)
            const sourceAccount = await client.getAccount(input.identity!)
            const account = new OrphanAccount(sourceAccount!)

            logger.info({ account })
            res.send(account)
        })
        .stdEntitlementList(async (context: Context, input: any, res: Response<StdEntitlementListOutput>) => {
            const sources = await client.listSources()
            const includedSources = sources.filter((x) => config.sources.includes(x.name))
            for (const source of includedSources) {
                const accounts = await client.listOrphanAccountsBySource(source.id!, config.onlyEnabled)
                for (const acc of accounts) {
                    const entitlement = new Group(acc)
                    logger.info({ entitlement })
                    res.send(entitlement)
                }
            }
        })
        .stdEntitlementRead(
            async (context: Context, input: StdEntitlementReadInput, res: Response<StdEntitlementReadOutput>) => {
                logger.info({ input })

                const sourceAccount = await client.getAccount(input.identity!)
                const entitlement = new Group(sourceAccount!)

                logger.info({ entitlement })
                res.send(entitlement)
            }
        )
        .stdAccountUpdate(
            async (context: Context, input: StdAccountUpdateInput, res: Response<StdAccountUpdateOutput>) => {
                logger.info({ input })

                for (const change of input.changes) {
                    const values = [].concat(change.value)
                    for (const value of values) {
                        switch (change.op) {
                            case AttributeChangeOp.Add:
                                logger.info('Skipping entitlement add request for orphan account')
                                break
                            case AttributeChangeOp.Remove:
                                await client.disableAccount(value)
                                break
                            default:
                                throw new ConnectorError(`Operation not supported: ${change.op}`)
                        }
                    }
                }

                const sourceAccount = await client.getAccount(input.identity!)
                const account = new OrphanAccount(sourceAccount!)

                logger.info({ account })
                res.send(account)
            }
        )
}
