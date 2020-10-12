const { composeCreatePullRequest } = require("octokit-plugin-create-pull-request");
const YAML = require('yaml');
const ejs = require('ejs');

let dockerHubAPI = require('docker-hub-api');

const owner_addon_repo = process.env.OWNER_ADDON_REPO;
const repo_addon_repo = process.env.REPO_ADDON_REPO;


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
        app.log.info(`Building addon files...`)
        
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
        // Edit files of addon
        let files = {};
        files[`${target}/CHANGELOG.md`] = change_log;
        files[`${target}/README.md`] = ejs.render(rdme_template, {version: version});
        files[`${target}/config.json`] = config_json
        app.log.info(`...Done`)
        
        // Global readme
        app.log.info('Building global ReadMe...')
        let template_context = {addons:[]}
        for(let addon in addon_manifest.addons){
            let repo_splited = addon_manifest.addons[addon].repository.split('/');
            let target = addon_manifest.addons[addon].target;
            let config_raw = await get_file_in_addon_repo(context, `${target}/config.json`);
            let config = JSON.parse(config_raw);

            let temp = {}
            temp['name'] = config.name;
            temp['version'] = config.version;
            temp['slug'] = config.slug;
            temp['description'] = config.description;
            temp['armhf'] = config.arch.includes('armhf');
            temp['armv7'] = config.arch.includes('armv7');
            temp['aarch64'] = config.arch.includes('aarch64');
            temp['amd64'] = config.arch.includes('amd64');
            temp['i386'] = config.arch.includes('i386');
            
            let hub_url = config.image;
            let max = -1;
            let max_arch = "";
            
            for(let arch_i in config.arch){
                let arch = config.arch[arch_i];
                let url = hub_url.replace('{arch}', arch).split('/');
                
                let info =  dockerHubAPI.repository(url[0], url[1]);
                if(info.pull_count > max)
                    max = info.pull_count;
                    max_arch = arch;
                
            }
            temp['pull_image'] = hub_url.replace('{arch}', max_arch);
            template_context.addons.push(temp);
            
        }
        app.log.info('...Done')
        let readme_global_template = await get_file_in_addon_repo(context, `.README.ejs`);
        files['README.md'] = ejs.render(readme_global_template, template_context);



        app.log.info('Creating Pull Request...')
        let commit_msg = `:arrow_up: Upgrade ${addon_name} to ${version}`
        let pr = composeCreatePullRequest(context.github,{
            owner: owner_addon_repo,
            repo: repo_addon_repo,
            title: `Upgrade ${addon_name} to ${version}` ,
            body: "",
            head: `${target}_${version}`,
            changes: 
            [
                {
                    files: files,
                    commit: commit_msg
                }
            ]
        }
        ).then(()=>{
            context.log.info('...Done')
        }).catch((error)=>{
            context.log.info(error)
        });
        
        
    });

    app.on("workflow_run", async context => {
        app.log.info('workflow !')
        if(context.payload.workflow_run.event == "push"){
            if(context.payload.workflow_run.conclusion == "success"){
                let id = context.payload.workflow_run.id;
                let repo_path = `${context.repo().owner}/${context.repo().repo}`;
                let version = `dev_${id}`
            }
        }
    });
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

