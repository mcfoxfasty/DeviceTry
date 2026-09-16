export interface OpenNextConfig {
  default: {
    override: {
      wrapper: string;
      converter: string;
      incrementalCache: string;
      tagCache: string;
      queue: string;
    };
  };
}

const config: OpenNextConfig = {
  default: {
    override: {
      wrapper: 'cloudflare-node',
      converter: 'edge',
      incrementalCache: 'dummy',
      tagCache: 'dummy',
      queue: 'dummy',
    },
  },
};

export default config;
