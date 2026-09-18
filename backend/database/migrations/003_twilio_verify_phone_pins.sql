ALTER TABLE phone_pin_challenges
  DROP CONSTRAINT phone_pin_challenges_hash_not_blank;

ALTER TABLE phone_pin_challenges
  ALTER COLUMN code_hash DROP NOT NULL;
