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
import {set, get} from 'lodash';

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
		icon: 'file:md5.svg',
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
					'<b>Hash Single Fields.</b><br><br> Capture the value using an expression and specify the <i>fixed</i> output path.',
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
				displayName:
					'<b>Hash Arrays.</b><br><br> Expects an array of objects. Specify the <i>fixed</i> path to the array, and a ' +
					'comma separated list of keys to hash. Is always done in-place. You can use empty brackets as wildcard to indicate ' +
					'arrays of arrays, for instance: level1[].level2[].level3',
				name: 'infoBox',
				type: 'notice',
				default: '',
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

				const fields = this.getNodeParameter('fieldsToHash.values', itemIndex, '') as Array<IKeyValuePair>
				for (const {val, key} of fields || []) {

					if (val && key) {
						const newValue = createHash('MD5').update(val).digest('HEX' as BinaryToTextEncoding);
						set(newItem, `json.${key}`, newValue);
					}
				}

				const arrays = this.getNodeParameter('arraysToHash.values', itemIndex, '') as Array<IPathKeysPair>

				for (const {path, keys} of arrays || []) {

					MD5Node.resolvePaths(path, item).forEach((actualPath) => {
						if (actualPath && keys) {

							const arr = get(item, `json.${actualPath}`) as Array<any>
							for (let i = 0; arr && i < arr.length; i++) {

								const keysToHash = keys.split(',').map(s => s.trim()) as Array<string>
								for (const key of keysToHash) {
									if (arr[i][key]) {
										const newValue = createHash('MD5').update(arr[i][key]).digest('HEX' as BinaryToTextEncoding);
										set(newItem, `json.${actualPath}[${i}].${key}`, newValue);
									}
								}
							}
						}
					});
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

	static resolvePaths(path: string, item: INodeExecutionData, paths: Array<string> = []): Array<string> {
		// treat empty brackets as wildcard and resolve to actual paths
		// level1[].level2[].level3
		// becomes:
		// level1[0].level2[0].level3
		// level1[0].level2[1].level3
		// level1[1].level2[0].level3
		// level1[1].level2[1].level3

		const idx = path.indexOf('[]');
		if (idx < 0) {
			paths.push(path)
		} else {
			const prefix = path.substring(0, idx)
			const suffix = path.substring(idx + 2)
			const arr = get(item, `json.${prefix}`) as Array<any>
			for (let i = 0; arr && i < arr.length; i++) {
				const newPrefix = `${prefix}[${i}]`
				if (suffix) {
					MD5Node.resolvePaths(newPrefix + suffix, item, paths)
				} else {
					paths.push(newPrefix)
				}
			}
		}
		return paths;
	}
}
