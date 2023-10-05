import { Attributes, StdEntitlementReadOutput } from '@sailpoint/connector-sdk'

const TAG = 'Orphan account'

export class Group {
    identity: string
    uuid: string
    type: string = 'group'
    attributes: Attributes

    constructor(object: any) {
        this.attributes = {
            tag: TAG,
            name: object.name === null ? '-' : object.name,
            displayName: `${TAG}: ${object.name === null ? '-' : object.name}`,
            id: object.id,
            description: `Source: ${object.sourceName}`,
            enabled: !object.disabled,
            locked: object.locked,
            source: object.sourceName,
        }
        this.identity = this.attributes.id as string
        this.uuid = this.attributes.displayName as string
    }
}
