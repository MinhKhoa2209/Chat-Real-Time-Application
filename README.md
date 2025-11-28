This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Project Structure

```
messenger-clone/
├── app/                          # Next.js App Router directory
│   ├── (site)/                   # Route group for site pages
│   │   ├── components/           # Site-specific components
│   │   │   ├── AuthForm.tsx
│   │   │   └── AuthSocialButton.tsx
│   │   └── page.tsx              # Landing/home page
│   ├── actions/                  # Server actions
│   │   ├── getConversation.ts
│   │   ├── getConversationById.ts
│   │   ├── getCurrentUser.ts
│   │   ├── getMessages.ts
│   │   ├── getSession.ts
│   │   └── getUsers.ts
│   ├── api/                      # API routes
│   │   ├── auth/
│   │   │   └── [...nextauth]/    # NextAuth.js catch-all route
│   │   │       └── route.ts
│   │   ├── conversations/
│   │   │   ├── [conversationId]/
│   │   │   │   ├── route.tsx
│   │   │   │   └── seen/
│   │   │   │       └── route.ts
│   │   │   └── route.ts
│   │   ├── gemini/               # Gemini AI integration
│   │   │   └── route.ts
│   │   ├── messages/
│   │   │   └── route.ts
│   │   ├── register/
│   │   │   └── route.ts
│   │   └── settings/
│   │       └── route.ts
│   ├── components/               # Shared UI components
│   │   ├── ActiveStatus.tsx
│   │   ├── Avatar.tsx
│   │   ├── AvatarGroup.tsx
│   │   ├── Button.tsx
│   │   ├── EmptyState.tsx
│   │   ├── LoadingModal.tsx
│   │   ├── Modal.tsx
│   │   ├── inputs/               # Form input components
│   │   │   ├── Input.tsx
│   │   │   └── Select.tsx
│   │   └── sidebar/              # Sidebar components
│   │       ├── DesktopItem.tsx
│   │       ├── DesktopSidebar.tsx
│   │       ├── MobileFooter.tsx
│   │       ├── MobileItem.tsx
│   │       ├── SettingModal.tsx
│   │       └── Sidebar.tsx
│   ├── context/                  # React context providers
│   │   ├── AuthContext.tsx
│   │   └── ToasterContext.tsx
│   ├── conversations/            # Conversations feature
│   │   ├── [conversationId]/     # Dynamic conversation route
│   │   │   ├── components/
│   │   │   │   ├── Body.tsx
│   │   │   │   ├── ConfirmModal.tsx
│   │   │   │   ├── Form.tsx
│   │   │   │   ├── Header.tsx
│   │   │   │   ├── ImageModal.tsx
│   │   │   │   ├── MessageBox.tsx
│   │   │   │   ├── MessageInput.tsx
│   │   │   │   └── ProfileDrawer.tsx
│   │   │   └── page.tsx
│   │   ├── components/
│   │   │   ├── ConversationBox.tsx
│   │   │   ├── ConversationList.tsx
│   │   │   └── GroupChatModal.tsx
│   │   ├── layout.tsx
│   │   ├── loading.tsx
│   │   └── page.tsx
│   ├── hooks/                    # Custom React hooks
│   │   ├── useActiveChannel.ts
│   │   ├── useActiveList.ts
│   │   ├── useConversation.ts
│   │   ├── useOtherUser.ts
│   │   └── useRoutes.ts
│   ├── libs/                     # Library configurations
│   │   ├── ai-service.ts         # AI service integration
│   │   ├── prismadb.ts           # Prisma database client
│   │   └── pusher.ts             # Pusher real-time configuration
│   ├── types/                    # TypeScript type definitions
│   │   └── index.tsx
│   ├── users/                    # Users feature
│   │   ├── components/
│   │   │   ├── UserBox.tsx
│   │   │   └── UserList.tsx
│   │   ├── layout.tsx
│   │   ├── loading.tsx
│   │   └── page.tsx
│   ├── favicon.ico
│   ├── globals.css               # Global styles
│   └── layout.tsx                # Root layout
├── pages/                        # Pages directory (legacy/API routes)
│   └── api/
│       └── pusher/
│           └── auth.ts          # Pusher authentication
├── public/                       # Static assets
│   ├── images/
│   │   ├── gemini_ai.png
│   │   ├── logo.webp
│   │   └── placeholder.webp
│   ├── file.svg
│   ├── globe.svg
│   ├── next.svg
│   ├── vercel.svg
│   └── window.svg
├── prisma/                       # Prisma ORM
│   └── schema.prisma            # Database schema
├── scripts/                     # Utility scripts
├── utils/                        # Utility functions
├── custom.d.ts                   # Custom TypeScript declarations
├── eslint.config.mjs             # ESLint configuration
├── next.config.ts                # Next.js configuration
├── next-env.d.ts                 # Next.js environment types
├── package.json                  # Dependencies
├── postcss.config.mjs            # PostCSS configuration
├── prisma.config.ts              # Prisma configuration
├── proxy.ts                      # Proxy configuration
├── README.md                     # Project documentation
└── tsconfig.json                 # TypeScript configuration
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
