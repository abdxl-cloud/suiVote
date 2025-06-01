# Frontend Deployment

This document outlines considerations and general steps for deploying the SuiVote Next.js frontend application.

## Deployment Platforms

Next.js applications can be deployed to various platforms. Some popular choices include:

*   **Vercel:** The creators of Next.js, Vercel offers seamless deployment, CI/CD, serverless functions, and global CDN out-of-the-box. It's often the easiest way to deploy Next.js apps.
*   **Netlify:** Another popular platform for deploying static sites and Jamstack applications, with good support for Next.js.
*   **AWS (Amplify, S3/CloudFront, EC2/ECS):** Amazon Web Services provides various options, from managed services like Amplify to more manual setups using S3 for static assets and EC2/ECS for server-side rendering.
*   **Google Cloud Platform (Cloud Run, Firebase Hosting):** GCP also offers robust solutions for hosting web applications.
*   **Azure (Static Web Apps, App Service):** Microsoft Azure provides similar capabilities.
*   **Self-hosting (e.g., using Docker on a VPS):** For more control, you can containerize the Next.js app and deploy it on your own server.

## General Deployment Steps (Example with Vercel)

### Using Vercel

1.  **Push your code to a Git provider:** Ensure your `suivote/frontend` directory is part of a Git repository (e.g., on GitHub, GitLab, Bitbucket).
2.  **Sign up/Log in to Vercel:** Visit [vercel.com](https://vercel.com/).
3.  **Import Project:**
    *   Click "New Project".
    *   Import your Git repository.
    *   Vercel will usually auto-detect that it's a Next.js project.
4.  **Configure Project:**
    *   **Root Directory:** If your Next.js app is in the `frontend` subdirectory, you'll need to specify this in Vercel's project settings (Build & Development Settings -> Root Directory).
    *   **Build Command:** `pnpm run build` (or `npm run build` / `yarn build` if you switched package managers).
    *   **Output Directory:** Vercel typically handles this automatically for Next.js (`.next`).
    *   **Install Command:** `pnpm install` (or `npm install` / `yarn install`).
5.  **Environment Variables:**
    *   You **MUST** configure the necessary environment variables in Vercel's project settings. These are critical for the application to connect to the correct Sui network and contracts.
    *   Refer to your local `.env.local` or `frontend/src/config/sui-config.ts` for the variables needed. These typically include:
        *   `NEXT_PUBLIC_SUI_NETWORK` (e.g., `devnet`, `testnet`, `mainnet`)
        *   `NEXT_PUBLIC_PACKAGE_ID` (The ID of your deployed SuiVote package)
        *   `NEXT_PUBLIC_ADMIN_ID` (The ID of your AdminCap object)
        *   Any other API keys or configuration values your application uses.
    *   **Important:** Do not commit sensitive keys directly into `sui-config.ts`. Use environment variables for production.
6.  **Deploy:** Click the "Deploy" button.

Vercel will build and deploy your application. You'll get a unique URL for your deployment.

## Build Process

Regardless of the platform, the frontend needs to be built for production:

```bash
cd frontend
pnpm run build
```

This command creates an optimized production build in the `.next` directory.

## Environment Variables

Properly managing environment variables is crucial:

*   **Local Development:** Use a `.env.local` file in the `frontend` directory (this file should be in `.gitignore`).
*   **Production:** Configure environment variables directly on your hosting platform (e.g., Vercel project settings, Netlify site settings).

Key variables to manage:

*   `NEXT_PUBLIC_SUI_NETWORK`: The Sui network (e.g., `devnet`, `testnet`, `mainnet`).
*   `NEXT_PUBLIC_PACKAGE_ID`: The ID of your deployed SuiVote package.
*   `NEXT_PUBLIC_ADMIN_ID`: The ID of your AdminCap or equivalent admin object.

Prefix public environment variables (accessible in the browser) with `NEXT_PUBLIC_`.

## Considerations

*   **Domain Name:** Configure a custom domain for your deployed application.
*   **HTTPS:** Ensure your deployment platform provides SSL/TLS certificates (most do automatically).
*   **CI/CD:** Set up Continuous Integration/Continuous Deployment pipelines to automatically build and deploy your application when you push changes to your Git repository.
*   **Monitoring and Logging:** Implement monitoring and logging to track application health and errors in production.

Choose the deployment platform and strategy that best fits your project's needs and your team's expertise.