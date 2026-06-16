"""Stub Temporal worker."""

import asyncio

from temporalio.client import Client
from temporalio.worker import Worker


async def main() -> None:
    client = await Client.connect("localhost:7233")
    worker = Worker(client, task_queue="mimir-tasks", workflows=[], activities=[])
    await worker.run()


if __name__ == "__main__":
    asyncio.run(main())
