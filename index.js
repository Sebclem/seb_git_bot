const { composeCreatePullRequest } = require("octokit-plugin-create-pull-request");
const YAML = require('yaml');

const owner_addon_repo = "Sebclem";
const repo_addon_repo = "sebclem-hassio-addon-repository";


/**
* This is the main entrypoint to your Probot app
* @param {import('probot').Application} app
*/
module.exports = app => {
    // Your code here
    app.log.info('Yay, the app was loaded!');
    
    app.on('release.published', async context => {
        let repo_path = `${context.repo().owner}/${context.repo().repo}` 
        let version = context.payload.release.tag_name;
        let change_log = context.payload.release.body;

        // Get addon manifest
        let addon_manifest_str = (await context.github.repos.getContent({
            owner: owner_addon_repo,
            repo: repo_addon_repo,
            path: ".addon.yml"
        })).data.content;
        let addon_manifest_str = Buffer.from(addon_manifest_str, "base64").toString();
        let addon_manifest = YAML.parse(addon_manifest_str);

        // Get the target and addon_name from the manifest
        let target = "nextcloud_backup";
        let addon_name = "nextcloud-backup";
        for(let addon in addon_manifest.addons){
            let repo = addon_manifest.addons[addon].repository;
            if(repo == repo_path){
                target = addon_manifest.addons[addon].target;
                addon_name = addon;
            }
            
        }

        let rdme_template = (await context.github.repos.getContent(context.repo({path: `${target}/.README.ejs`}))).data.content;
        rdme_template = Buffer.from(rdme_template, "base64").toString();


        let files = {};
        files[`${target}/CHANGELOG.md`] = change_log;
        // let pr = await composeCreatePullRequest(context.github,{
        //   owner: "Sebclem",
        //   repo: "sebclem-hassio-addon-repository",
        //   title: "bot-test",
        //   body: "bot-test",
        //   base: "master",
        //   head: "pr-bot-test",
        //   changes: {
        //     files: {
        //       "nextcloud_backup/README.md": "test"
        //     },
        //     commit: "Bot test"
        //   }
        // }
        // );
        
        
        app.log.info('release ?');
    });
    
    
    
    
    
    // const branch = `add-${fields.file.path}` // your branch's name
    // const content = Buffer.from(fields.file.content).toString('base64') // content for your configuration file
    
    // const reference = await context.github.gitdata.getReference(context.repo({ ref: 'heads/master' })) // get the reference for the master branch
    
    // const getBranch = await context.github.gitdata.createReference(context.repo({
    //   ref: `refs/heads/${ branch }`,
    //   sha: reference.data.object.sha
    // })) // create a reference in git for your branch
    
    // const file = await context.github.repos.createFile(context.repo({
    //   path: fields.file.path, // the path to your config file
    //   message: `adds ${fields.file.path}`, // a commit message
    //   content,
    //   branch
    // })) // create your config file
    
    // return await context.github.pullRequests.create(context.repo({
    //   title: fields.pr.title, // the title of the PR
    //   head: branch,
    //   base: 'master', // where you want to merge your changes
    //   body: fields.pr.body, // the body of your PR,
    //   maintainer_can_modify: true // allows maintainers to edit your app's PR
    // }))
}

