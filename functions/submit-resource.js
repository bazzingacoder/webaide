const { Octokit } = require("@octokit/rest");

exports.handler = async function(event) {
  // 1. GITHUB AND REPO CONFIGURATION
  const GITHUB_TOKEN = process.env.GITHUB_PAT;
  const REPO_OWNER = "bazzingacoder"; // <-- REPLACE with your GitHub username
  const REPO_NAME = "webaide"; // <-- REPLACE with your repository name if different

  // 2. Initialize GitHub API client
  const octokit = new Octokit({ auth: GITHUB_TOKEN });

  // 3. Parse the form data from the submission
  const formData = new URLSearchParams(event.body);
  
  // 4. Get the new resource details
  const newResource = {
    Category: formData.get('resource-category'),
    "Resource Text": formData.get('resource-title'),
    URL: formData.get('resource-url'),
    Description: formData.get('resource-description') || "",
  };

  // Create a unique branch name for the submission
  const branchName = `submission-${Date.now()}`;

  try {
    // 5. Get the latest commit SHA and the current resources.json content
    const { data: mainBranch } = await octokit.repos.getBranch({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      branch: 'main', 
    });
    const latestCommitSha = mainBranch.commit.sha;

    const { data: currentFile } = await octokit.repos.getContent({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'resources.json',
      ref: latestCommitSha,
    });

    const content = Buffer.from(currentFile.content, 'base64').toString('utf8');
    const resources = JSON.parse(content);
    
    // 6. Add the new resource to the array
    resources.push(newResource);
    
    // 7. Create a new branch
    await octokit.git.createRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `refs/heads/${branchName}`,
      sha: latestCommitSha,
    });

    // 8. Commit the updated resources.json to the new branch
    await octokit.repos.createOrUpdateFileContents({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      path: 'resources.json',
      message: `feat: Add new resource submission - ${newResource['Resource Text']}`,
      content: Buffer.from(JSON.stringify(resources, null, 4)).toString('base64'),
      sha: currentFile.sha,
      branch: branchName,
      committer: {
        name: 'Webaide Bot',
        email: 'bot@webaide.com',
      },
    });

    // 9. Create the Pull Request
    await octokit.pulls.create({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      title: `New Resource Submission: ${newResource['Resource Text']}`,
      head: branchName,
      base: 'main',
      body: `A new resource has been submitted via the website form.\n\nPlease review the changes and merge if approved.\n\n**Details:**\n- **Title:** ${newResource['Resource Text']}\n- **URL:** ${newResource.URL}\n- **Category:** ${newResource.Category}\n- **Description:** ${newResource.Description}`,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Resource submitted! A pull request has been created for review." }),
    };

  } catch (error) {
    console.error("Error processing submission:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "An error occurred while processing your submission." }),
    };
  }
};