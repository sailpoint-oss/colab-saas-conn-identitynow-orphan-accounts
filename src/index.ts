import {
    ConnectorError,
    createConnector,
    readConfig,
    logger,
    AttributeChangeOp,
    StdTestConnectionHandler,
    StdAccountListHandler,
    StdAccountCreateHandler,
    StdAccountReadHandler,
    StdAccountDisableHandler,
    StdAccountEnableHandler,
    StdEntitlementListHandler,
    StdEntitlementReadHandler,
    StdAccountUpdateHandler,
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

    const stdTestConnection: StdTestConnectionHandler = async (context, input, res) => {
        try {
            const response = await client.publicIdentities()
            res.send({})
        } catch (e) {
            throw new ConnectorError('Unable to connect to Identity Security Cloud')
        }
    }

    const stdAccountList: StdAccountListHandler = async (context, input, res) => {
        logger.info('Account list')
        const sources = await client.listSources()
        const includedSources = sources.filter((x) => config.sources.includes(x.name))
        for (const source of includedSources) {
            const accounts = await client.listOrphanAccountsBySource(source.id!, config.onlyEnabled)
            for (const acc of accounts) {
                const account = new OrphanAccount(acc, input.schema)
                res.send(account)
            }
        }
    }

    const stdAccountCreate: StdAccountCreateHandler = async (context, input, res) => {
        logger.info({ input })

        const identity = await client.getIdentityByUID(input.attributes.name)
        await client.correlateAccount(identity!.id, input.identity!)
        const sourceAccount = await client.getAccount(input.identity!)
        const account = new OrphanAccount(sourceAccount!, input.schema)

        logger.info({ account })
        res.send(account)
    }

    const stdAccountRead: StdAccountReadHandler = async (context, input, res) => {
        logger.info({ input })

        const sourceAccount = await client.getAccount(input.identity!)
        const account = new OrphanAccount(sourceAccount!, input.schema)

        logger.info({ account })
    }

    const stdAccountDisable: StdAccountDisableHandler = async (context, input, res) => {
        logger.info({ input })

        await client.disableAccount(input.identity)
        const sourceAccount = await client.getAccount(input.identity!)
        const account = new OrphanAccount(sourceAccount!, input.schema)

        logger.info({ account })
        res.send(account)
    }

    const stdAccountEnable: StdAccountEnableHandler = async (context, input, res) => {
        logger.info({ input })

        await client.disableAccount(input.identity)
        const sourceAccount = await client.getAccount(input.identity!)
        const account = new OrphanAccount(sourceAccount!, input.schema)

        logger.info({ account })
        res.send(account)
    }

    const stdEntitlementList: StdEntitlementListHandler = async (context, input, res) => {
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
    }

    const stdEntitlementRead: StdEntitlementReadHandler = async (context, input, res) => {
        logger.info({ input })

        const sourceAccount = await client.getAccount(input.identity!)
        const entitlement = new Group(sourceAccount!)

        logger.info({ entitlement })
        res.send(entitlement)
    }

    const stdAccountUpdate: StdAccountUpdateHandler = async (context, input, res) => {
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
        const account = new OrphanAccount(sourceAccount!, input.schema)

        logger.info({ account })
        res.send(account)
    }

    return createConnector()
        .stdTestConnection(stdTestConnection)
        .stdAccountList(stdAccountList)
        .stdAccountRead(stdAccountRead)
        .stdEntitlementList(stdEntitlementList)
        .stdEntitlementRead(stdEntitlementRead)
        .stdAccountCreate(stdAccountCreate)
        .stdAccountUpdate(stdAccountUpdate)
        .stdAccountEnable(stdAccountEnable)
        .stdAccountDisable(stdAccountDisable)
}
