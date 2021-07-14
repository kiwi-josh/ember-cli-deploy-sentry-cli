/* eslint-disable comma-dangle */
/* eslint-disable max-len, max-lines-per-function */
// eslint-disable-next-line strict
'use strict';

const path = require('path');
const { execSync } = require('child_process');
const BasePlugin = require('ember-cli-deploy-plugin');

module.exports = {
  name: require('./package').name,

  createDeployPlugin(options) {
    const DeployPlugin = BasePlugin.extend({
      name: options.name,

      defaultConfig: {
        assetsDir(context) {
          return path.join(context.distDir, 'assets');
        },

        revisionKey(context) {
          return context.revisionData && context.revisionData.revisionKey;
        },

        environment(context) {
          return context.deployTarget;
        },

        url: '',
      },

      requiredConfig: ['appName', 'orgName', 'authToken'],

      didPrepare() {
        const releaseName = `${this.readConfig('appName')}@${this.readConfig('revisionKey')}`;
        const assetsDir = this.readConfig('assetsDir');
        const urlPrefix = this.readConfig('urlPrefix') ? `--url-prefix '${this.readConfig('urlPrefix')}'` : '';
        const stripPrefix = this.readConfig('stripPrefix') ? `--strip-prefix '${this.readConfig('stripPrefix')}'` : '';
        const noSourcemapReference = this.readConfig('noSourcemapReference') ? `--no-sourcemap-reference` : '';
        const noRewrite = this.readConfig('noRewrite') ? `--no-rewrite` : '';

        const setCommits = this.readConfig('setCommits') ? true : false;
        const uploadFilesCommand = this.readConfig('uploadFilesCommand') ? true : false;
        const uploadSourcemapFilesCommand = this.readConfig('uploadSourcemapFilesCommand') ? true : false;

        const extConfig = this.readConfig('ext') || [];
        const ext = extConfig.length ? extConfig.map((e) => `--ext=${e}`).join(' ') : '';

        const filesExtConfig = this.readConfig('ext') || [];
        const filesExt = extConfig.length ? filesExtConfig.map((e) => `--ext=${e}`).join(' ') : '';

        this.log('SENTRY: Creating release...');
        this.sentryCliExec('releases', `new ${releaseName}`);

        if (setCommits) {
          this.log('SENTRY: Assigning commits...');
          this.sentryCliExec('releases', `set-commits ${releaseName} --auto --ignore-missing`);
        }

        if (uploadFilesCommand) {
          const filesCommand = `files ${releaseName} upload ${assetsDir} ${urlPrefix} ${filesExt}`;
          this.log('SENTRY: Uploading files...');
          this.log(`SENTRY: ${filesCommand}`)
          this.sentryCliExec('releases', filesCommand);
        }

        if (uploadSourcemapFilesCommand) {
          const sourcemapsCommand = `files ${releaseName} upload-sourcemaps ${assetsDir} ${urlPrefix} ${stripPrefix} ${noSourcemapReference} ${noRewrite} ${ext}`;
          this.log('SENTRY: Uploading source maps...');
          this.log(`SENTRY: ${sourcemapsCommand}`)
          this.sentryCliExec('releases', sourcemapsCommand);
        }

        this.log('SENTRY: Finalizing release...');
        this.sentryCliExec('releases', `finalize ${releaseName}`);

        this.log('SENTRY: Release published!...');
      },

      didDeploy() {
        const appName = this.readConfig('appName');
        const releaseName = `${appName}@${this.readConfig('revisionKey')}`;
        const environment = this.readConfig('environment');

        this.log('SENTRY: Deploying release...');
        this.sentryCliExec('releases', `deploys ${releaseName} new -e ${environment}`);
        this.log('SENTRY: Deployed!');
      },

      didFail() {
        const appName = this.readConfig('appName');
        const releaseName = `${appName}@${this.readConfig('revisionKey')}`;

        this.log('SENTRY: Deleting release...');
        this.sentryCliExec('releases', `delete ${releaseName}`);
        this.log('SENTRY: Release deleted!');
      },

      sentryCliExec(command, subCommand) {
        const authToken = this.readConfig('authToken');
        const orgName = this.readConfig('orgName');
        const appName = this.readConfig('appName');
        const url = this.readConfig('url');

        return this._exec(
          [
            path.join('node_modules', '.bin', 'sentry-cli'),
            url ? `--url ${url}` : '',
            `--auth-token ${authToken}`,
            command,
            `--org ${orgName}`,
            `--project ${appName}`,
            subCommand,
          ].join(' ')
        );
      },

      _exec(command = '') {
        return execSync(command, { cwd: this.project.root });
      },
    });

    return new DeployPlugin();
  },
};
