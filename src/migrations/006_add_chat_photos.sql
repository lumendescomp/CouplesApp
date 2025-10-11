-- Migration: Add photo support to chat messages
-- Description: Add photo_path column to enable image sharing in chat

ALTER TABLE chat_messages ADD COLUMN photo_path TEXT;
ALTER TABLE chat_messages ADD COLUMN message_type TEXT DEFAULT 'text' CHECK(message_type IN ('text', 'photo'));
