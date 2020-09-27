const { composeCreatePullRequest } = require("octokit-plugin-create-pull-request");
const YAML = require('yaml');
const ejs = require('ejs')

const owner_addon_repo = "Sebclem";
const repo_addon_repo = "test_bot";


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

        app.log.info(`New realese in ${repo_path} => ${version}`)
        
        // Get addon manifest
        let addon_manifest = YAML.parse((await get_file_in_addon_repo(context, '.addon.yml')));
        
        // Get the target and addon_name from the manifest
        let target = "";
        let addon_name = "";
        for(let addon in addon_manifest.addons){
            let repo = addon_manifest.addons[addon].repository;
            if(repo == repo_path){
                target = addon_manifest.addons[addon].target;
                addon_name = addon;
            }
            
        }
        
        // Get Readme Template
        let rdme_template = await get_file_in_current_repo(context, `${target}/.README.ejs`);
        
        // Get config.json
        let config_json = await get_file_in_addon_repo(context, `${target}/config.json`);
        config_json = JSON.parse(config_json);
        
        config_json['version'] = version;
        config_json = JSON.stringify(config_json, null, 4)
        
        let files = {};
        files[`${target}/CHANGELOG.md`] = change_log;
        files[`${target}/README.md`] = ejs.render(rdme_template, {version: version});
        files[`${target}/config.json`] = config_json
        
        let commit_msg = `:arrow_up: Upgrade ${addon_name} to ${version}`
        
        
        let pr = composeCreatePullRequest(context.github,{
            owner: owner_addon_repo,
            repo: repo_addon_repo,
            title: `Upgrade ${addon_name} to ${version}` ,
            body: "",
            head: `${target}_${versionnp}`,
            changes: 
            [
                {
                    files: files,
                    commit: commit_msg
                }
            ]
        }
        ).then(()=>{
            context.log.info('Pull request created !')
        }).catch((error)=>{
            context.log.info(error)
        });
        
        
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


async function get_file_in_current_repo(context, path){
    let str = (await context.github.repos.getContent(context.repo({path: path}))).data.content;
    return Buffer.from(str, "base64").toString();
}

async function get_file_in_addon_repo(context, path){
    let str = (await context.github.repos.getContent({
        owner: owner_addon_repo,
        repo: repo_addon_repo,
        path: path
    })).data.content;
    return Buffer.from(str, "base64").toString();
}

