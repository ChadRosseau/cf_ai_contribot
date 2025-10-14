/**
 * Adapter registry for managing data source adapters
 */

import type { ScraperAdapter } from "./base-adapter";
import { AwesomeForBeginnersAdapter } from "./awesome-for-beginners";

export interface DataSourceConfig {
	id: string;
	url: string;
	enabled: boolean;
}

export class AdapterRegistry {
	private adapters: Map<string, ScraperAdapter> = new Map();

	constructor() {
		// Register all adapters
		this.register(new AwesomeForBeginnersAdapter());
	}

	register(adapter: ScraperAdapter) {
		this.adapters.set(adapter.id, adapter);
		console.log(`Registered adapter: ${adapter.name} (${adapter.id})`);
	}

	get(id: string): ScraperAdapter | undefined {
		return this.adapters.get(id);
	}

	getAll(): ScraperAdapter[] {
		return Array.from(this.adapters.values());
	}
}

// Hardcoded data source configurations
export const DATA_SOURCE_CONFIGS: DataSourceConfig[] = [
	{
		id: "awesome-for-beginners",
		url: "https://raw.githubusercontent.com/MunGell/awesome-for-beginners/master/data.json",
		enabled: true,
	},
];
