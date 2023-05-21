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
import get from 'lodash.get';

interface IKeyValuePair {
	val: string;
	key: string
}

interface IPathKeysPair {
	path: string;
	keys: string
}

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
				displayName:
					'You have been put on notice',
				name: 'infoBox',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Fields to Hash',
				name: 'fieldsToHash',
				type: 'fixedCollection',
				placeholder: 'Add Fields to Hash',
				default: {values: [{val: '', key: ''}]},
				typeOptions: {
					multipleValues: true,
				},
				options: [
					{
						displayName: 'Values',
						name: 'values',
						values: [
							{
								displayName: 'Value',
								name: 'val',
								type: 'string',
								default: '',
								// eslint-disable-next-line n8n-nodes-base/node-param-placeholder-miscased-id
								placeholder: '',
								hint: 'Use an expression to capture the value',
							},
							{
								displayName: 'Key',
								name: 'key',
								type: 'string',
								default: '',
								// eslint-disable-next-line n8n-nodes-base/node-param-placeholder-miscased-id
								placeholder: '',
								hint: 'This is the output path, may be the same as input path',
							},
						],
					},
				],
			},
			{
				displayName: 'Arrays to Hash',
				name: 'arraysToHash',
				type: 'fixedCollection',
				placeholder: 'Add Arrays to Hash',
				default: {values: [{path: '', keys: ''}]},
				typeOptions: {
					multipleValues: true,
				},
				options: [
					{
						displayName: 'Arrays',
						name: 'values',
						values: [
							{
								displayName: 'Path',
								name: 'path',
								type: 'string',
								default: '',
								// eslint-disable-next-line n8n-nodes-base/node-param-placeholder-miscased-id
								placeholder: '',
								hint: 'Path to the array',
							},
							{
								displayName: 'Keys',
								name: 'keys',
								type: 'string',
								default: '',
								// eslint-disable-next-line n8n-nodes-base/node-param-placeholder-miscased-id
								placeholder: '',
								hint: 'Keys to hash',
							},
						],
					},
				],
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		let item: INodeExecutionData;
		let newItem: INodeExecutionData;

		// Iterates over all input items
		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				item = items[itemIndex];

				newItem = {
					json: deepCopy(item.json),
					pairedItem: {
						item: itemIndex,
					},
				};

				const values = this.getNodeParameter('fieldsToHash.values', itemIndex, '') as Array<IKeyValuePair>
				for (const { val, key } of values || []) {

					if (val && key) {
						const newValue = createHash('MD5').update(val).digest('HEX' as BinaryToTextEncoding);
						set(newItem, `json.${key}`, newValue);
					}
				}

				const arrays = this.getNodeParameter('arraysToHash.values', itemIndex, '') as Array<IPathKeysPair>
				for (const { path, keys } of arrays || []) {

					if (path && keys) {
						  const arr = get(item, `json.${path}`) as Array<any>
						  if (arr && arr.length) {
								 const keysToHash = keys.split(',').map(s => s.trim()) as Array<string>
								 for (const keyToHash of keysToHash) {
									   const obj = arr[0]
									   if (obj[keyToHash]) {
											 const newValue = createHash('MD5').update(obj[keyToHash]).digest('HEX' as BinaryToTextEncoding);
											 set(newItem, `json.${path}[0].${keyToHash}`, newValue);
										 }
								 }
							}
					}
				}

				returnData.push(newItem)

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
