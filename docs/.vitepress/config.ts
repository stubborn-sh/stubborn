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
    /^\/contract\//,
  ],

  themeConfig: {
    siteTitle: 'Stubborn',

    nav: [
      { text: 'Getting Started', link: '/stubborn/getting-started' },
      { text: 'Features', link: '/stubborn/features/application-registration' },
      {
        text: 'Reference',
        items: [
          { text: 'Architecture', link: '/stubborn/architecture' },
          { text: 'API Reference', link: '/stubborn/api-reference' },
          { text: 'Observability', link: '/stubborn/observability' },
          { text: 'Contract Stubs', link: '/stubborn/contract-stubs' },
        ],
      },
      {
        text: 'Stubborn Ecosystem',
        items: [
          { text: 'Broker (this site)', link: '/stubborn/' },
          { text: 'Contract', link: '/contract/' },
        ],
      },
      { text: 'GitHub', link: 'https://github.com/stubborn-sh/stubborn' },
    ],

    sidebar: [
      { text: 'Getting Started', link: '/stubborn/getting-started' },
      { text: 'UI Tour', link: '/stubborn/ui-tour' },
      {
        text: 'Features',
        collapsed: false,
        items: [
          { text: 'Application Registration', link: '/stubborn/features/application-registration' },
          { text: 'Contract Publishing', link: '/stubborn/features/contract-publishing' },
          { text: 'Verification Results', link: '/stubborn/features/verification-results' },
          { text: 'Environment Tracking', link: '/stubborn/features/environment-tracking' },
          { text: 'Can I Deploy', link: '/stubborn/features/can-i-deploy' },
          { text: 'Security', link: '/stubborn/features/security' },
          { text: 'AI Traffic Proxy', link: '/stubborn/features/ai-traffic-proxy' },
          { text: 'Dependency Graph', link: '/stubborn/features/dependency-graph' },
          { text: 'Webhooks', link: '/stubborn/features/webhooks' },
          { text: 'Branches', link: '/stubborn/features/branches' },
          { text: 'Content Hash', link: '/stubborn/features/content-hash' },
          { text: 'Pending Contracts', link: '/stubborn/features/pending-contracts' },
          { text: 'Selectors', link: '/stubborn/features/selectors' },
          { text: 'Compatibility Matrix', link: '/stubborn/features/matrix' },
          { text: 'Tags', link: '/stubborn/features/tags' },
          { text: 'Cleanup', link: '/stubborn/features/cleanup' },
          { text: 'Configurable Environments', link: '/stubborn/features/configurable-environments' },
          { text: 'MCP Server', link: '/stubborn/features/mcp-server' },
          { text: 'CLI', link: '/stubborn/features/cli' },
          { text: 'Contract Publishing Plugins', link: '/stubborn/features/contract-publishing-plugins' },
          { text: 'JS SDK', link: '/stubborn/features/js-sdk' },
          { text: 'Maven Import', link: '/stubborn/features/maven-import' },
        ],
      },
      {
        text: 'Reference',
        collapsed: false,
        items: [
          { text: 'Architecture', link: '/stubborn/architecture' },
          { text: 'API Reference', link: '/stubborn/api-reference' },
          { text: 'Observability', link: '/stubborn/observability' },
          { text: 'Contract Stubs', link: '/stubborn/contract-stubs' },
        ],
      },
      { text: 'Development Guide', link: '/stubborn/development-guide' },
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
