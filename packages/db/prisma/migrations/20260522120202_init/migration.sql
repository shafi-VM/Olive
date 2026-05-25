-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('user', 'assistant', 'system');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('active', 'cancelled', 'archived');

-- CreateEnum
CREATE TYPE "InferenceStatus" AS ENUM ('success', 'error', 'cancelled');

-- CreateTable
CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "sequence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inference_logs" (
    "id" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "conversationId" UUID,
    "messageId" UUID,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "status" "InferenceStatus" NOT NULL,
    "latencyMs" INTEGER NOT NULL,
    "promptTokens" INTEGER,
    "completionTokens" INTEGER,
    "totalTokens" INTEGER,
    "errorType" TEXT,
    "errorMessage" TEXT,
    "inputPreview" TEXT,
    "outputPreview" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inference_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "conversations_status_updatedAt_idx" ON "conversations"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "messages_conversationId_createdAt_idx" ON "messages"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "messages_conversationId_sequence_key" ON "messages"("conversationId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "inference_logs_requestId_key" ON "inference_logs"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "inference_logs_messageId_key" ON "inference_logs"("messageId");

-- CreateIndex
CREATE INDEX "inference_logs_provider_model_idx" ON "inference_logs"("provider", "model");

-- CreateIndex
CREATE INDEX "inference_logs_status_idx" ON "inference_logs"("status");

-- CreateIndex
CREATE INDEX "inference_logs_createdAt_idx" ON "inference_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inference_logs" ADD CONSTRAINT "inference_logs_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inference_logs" ADD CONSTRAINT "inference_logs_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;
