"use server";

import prisma from "@/lib/db";
import { auth } from "@/lib/auth";
import { createWebhook, getRepositories } from "@/module/github/github";
import { headers } from "next/headers";

export const fetchRepositories = async (
  page: number = 1,
  perPage: number = 10,
) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  const githubRepos = await getRepositories(page, perPage);

  const dbRepos = await prisma.repository.findMany({
    where: {
      userId: session.user.id,
    },
  });

  const connectedRepoIds = new Set(dbRepos.map((repo) => repo.githubId));

  return githubRepos.map((repo: any) => ({
    ...repo,
    isConnected: connectedRepoIds.has(BigInt(repo.id)),
  }));
};

export async function connectRepository(
  owner: string,
  repo: string,
  githubId: number,
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  // const canConnect = await canConnectRepository(session.user.id);

  // if (!canConnect) {
  //   throw new Error(
  //     "Repository limit reached. Please upgrade to PRO for unlimited repositories.",
  //   );
  // }

  const webhook = await createWebhook(owner, repo);

  if (webhook) {
    await prisma.repository.create({
      data: {
        githubId: BigInt(githubId),
        name: repo,
        owner,
        fullName: `${owner}/${repo}`,
        url: `https://github.com/${owner}/${repo}`,
        userId: session.user.id,
      },
    });

    // await incrementRepositoryCount(session.user.id);

  //   try {
  //     await inngest.send({
  //       name: "repository.connected",
  //       data: {
  //         owner,
  //         repo,
  //         userId: session.user.id,
  //       },
  //     });
  //   } catch (error) {
  //     console.error("Failed to trigger repository indexing:", error);
  //   }
  }

  return webhook;
}
