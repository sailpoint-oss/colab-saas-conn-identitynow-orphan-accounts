import { Attributes, StdEntitlementListOutput, StdEntitlementReadOutput } from '@sailpoint/connector-sdk'
import { Account } from 'sailpoint-api-client'

const TAG = 'Orphan account'

export class Group implements StdEntitlementListOutput {
    identity: string
    uuid: string
    type: string = 'group'
    attributes: Attributes

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
        this.identity = this.attributes.id as string
        this.uuid = this.attributes.displayName as string
    }
}
