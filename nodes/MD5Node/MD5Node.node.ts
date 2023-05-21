import {IExecuteFunctions} from 'n8n-core';
import {
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';

import type {BinaryToTextEncoding} from 'crypto';
import {createHash} from 'crypto';
import {deepCopy} from 'n8n-workflow';
import set from 'lodash.set';

export class MD5Node implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'MD5 Node',
		name: 'md5 node',
		group: ['transform'],
		version: 1,
		description: 'MD5 Hashing Node',
		defaults: {
			name: 'MD5',
		},
		inputs: ['main'],
		outputs: ['main'],
		properties: [
			// Node properties which the user gets displayed and
			// can change on the node.
			{
				displayName: 'Value',
				name: 'val',
				type: 'string',
				default: '',
				placeholder: '',
				description: 'Value to be hashed',
			},
			{
				displayName: 'Key',
				name: 'key',
				type: 'string',
				default: '',
				placeholder: '',
				description: 'Key to store the result',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		let item: INodeExecutionData;
		let key: string, val: string;
		let newItem: INodeExecutionData;

		// Iterates over all input items
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				item = items[itemIndex];

				key = this.getNodeParameter('key', itemIndex, '') as string;
				val = this.getNodeParameter('val', itemIndex, '') as string;

				if (key && val) {
					const newValue = createHash('MD5').update(val).digest('HEX' as BinaryToTextEncoding);
					if (key.includes('.')) {
						// Uses dot notation so copy all data
						newItem = {
							json: deepCopy(item.json),
							pairedItem: {
								item: itemIndex,
							},
						};
					} else {
						newItem = {
							json: {...item.json},
							pairedItem: {
								item: itemIndex,
							},
						};
						set(newItem, `json.${key}`, newValue);
						returnData.push(newItem)
					}
				}
			} catch (error) {

				if (this.continueOnFail()) {
					items.push({json: this.getInputData(itemIndex)[0].json, error, pairedItem: itemIndex});
				} else {
					// Adding `itemIndex` allows other workflows to handle this error
					if (error.context) {
						// If the error thrown already contains the context property,
						// only append the itemIndex
						error.context.itemIndex = itemIndex;
						throw error;
					}
					throw new NodeOperationError(this.getNode(), error, {
						itemIndex,
					});
				}
			}
		}

		return this.prepareOutputData(returnData);
	}
}
