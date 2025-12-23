import { AccountSchema, Attributes, readConfig, StdAccountReadOutput } from '@sailpoint/connector-sdk'
import { Account } from 'sailpoint-api-client'

const TAG = 'Orphan account'

export class OrphanAccount implements StdAccountReadOutput {
    identity: string
    uuid: string
    attributes: Attributes
    disabled: boolean
    locked: boolean

    constructor(account: Account, schema?: AccountSchema) {
        this.attributes = {
            tag: TAG,
            name: account.name === null ? '-' : account.name,
            displayName: `${TAG}: ${account.name === null ? '-' : account.name} (${account.sourceName})`,
            id: account.id!,
            description: `Source: ${account.sourceName}`,
            enabled: !account.disabled,
            locked: account.locked,
            source: account.sourceName,
        }

        if (schema) {
            this.identity = this.attributes[schema.identityAttribute] as string
            this.uuid = this.attributes[schema.displayAttribute] as string
        } else {
            this.identity = this.attributes.id as string
            this.uuid = this.attributes.displayName as string
        }
        this.locked = account.locked
        this.disabled = account.disabled
    }
}
