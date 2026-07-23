import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'en-US',
  title: 'Stubborn Broker',
  description: 'Contract governance for any stack — JVM, Node.js, and beyond.',
  base: '/stubborn/',

  head: [
    ['link', { rel: 'icon', href: '/stubborn/favicon.ico' }],
  ],

  srcExclude: ['**/specs/**', '**/decisions/**', '**/plan/**'],

  ignoreDeadLinks: [
    /^http:\/\/localhost/,
  ],

  themeConfig: {
    siteTitle: 'Stubborn',

    nav: [
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'Features', link: '/features/application-registration' },
      {
        text: 'Reference',
        items: [
          { text: 'Architecture', link: '/architecture' },
          { text: 'API Reference', link: '/api-reference' },
          { text: 'Observability', link: '/observability' },
          { text: 'Contract Stubs', link: '/contract-stubs' },
        ],
      },
      {
        text: 'Stubborn Ecosystem',
        items: [
          { text: 'Broker (this site)', link: '/' },
          { text: 'Contract', link: 'https://docs.stubborn.sh/contract/' },
        ],
      },
      { text: 'GitHub', link: 'https://github.com/stubborn-sh/stubborn' },
    ],

    sidebar: [
      { text: 'Getting Started', link: '/getting-started' },
      { text: 'UI Tour', link: '/ui-tour' },
      {
        text: 'Features',
        collapsed: false,
        items: [
          { text: 'Application Registration', link: '/features/application-registration' },
          { text: 'Contract Publishing', link: '/features/contract-publishing' },
          { text: 'Verification Results', link: '/features/verification-results' },
          { text: 'Environment Tracking', link: '/features/environment-tracking' },
          { text: 'Can I Deploy', link: '/features/can-i-deploy' },
          { text: 'Security', link: '/features/security' },
          { text: 'AI Traffic Proxy', link: '/features/ai-traffic-proxy' },
          { text: 'Dependency Graph', link: '/features/dependency-graph' },
          { text: 'Webhooks', link: '/features/webhooks' },
          { text: 'Branches', link: '/features/branches' },
          { text: 'Content Hash', link: '/features/content-hash' },
          { text: 'Pending Contracts', link: '/features/pending-contracts' },
          { text: 'Selectors', link: '/features/selectors' },
          { text: 'Compatibility Matrix', link: '/features/matrix' },
          { text: 'Tags', link: '/features/tags' },
          { text: 'Cleanup', link: '/features/cleanup' },
          { text: 'Configurable Environments', link: '/features/configurable-environments' },
          { text: 'MCP Server', link: '/features/mcp-server' },
          { text: 'CLI', link: '/features/cli' },
          { text: 'Contract Publishing Plugins', link: '/features/contract-publishing-plugins' },
          { text: 'JS SDK', link: '/features/js-sdk' },
          { text: 'Maven Import', link: '/features/maven-import' },
        ],
      },
      {
        text: 'Reference',
        collapsed: false,
        items: [
          { text: 'Architecture', link: '/architecture' },
          { text: 'API Reference', link: '/api-reference' },
          { text: 'Observability', link: '/observability' },
          { text: 'Contract Stubs', link: '/contract-stubs' },
        ],
      },
      { text: 'Development Guide', link: '/development-guide' },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/stubborn-sh/stubborn' },
    ],

    footer: {
      message: 'Released under the Apache 2.0 License.',
      copyright: 'Copyright © 2024-present Marcin Grzejszczak and contributors.',
    },

    search: { provider: 'local' },

    editLink: {
      pattern: 'https://github.com/stubborn-sh/stubborn/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },
})
