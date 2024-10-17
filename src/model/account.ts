import { Attributes, StdAccountReadOutput } from '@sailpoint/connector-sdk'
import { Account } from 'sailpoint-api-client'

const TAG = 'Orphan account'

export class OrphanAccount implements StdAccountReadOutput {
    identity: string
    uuid: string
    attributes: Attributes
    disabled: boolean
    locked: boolean

    constructor(account: Account) {
        this.attributes = {
            tag: TAG,
            name: account.name === null ? '-' : account.name,
            displayName: `${TAG}: ${account.name === null ? '-' : account.name}`,
            id: account.id!,
            description: `Source: ${account.sourceName}`,
            enabled: !account.disabled,
            locked: account.locked,
            source: account.sourceName,
        }

        this.locked = account.locked
        this.disabled = account.disabled
        this.identity = this.attributes.id as string
        this.uuid = this.attributes.displayName as string
    }
}
