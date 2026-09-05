-- Atomic coin deduction: prevents race conditions where concurrent requests
-- could overdraft a user's balance.
-- Run this in Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.deduct_user_coins(p_user_id uuid, p_amount integer)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_coins integer;
BEGIN
  UPDATE public.users
  SET coins = coins - p_amount,
      updated_at = now()
  WHERE id = p_user_id
    AND coins >= p_amount
  RETURNING coins INTO v_new_coins;

  IF v_new_coins IS NULL THEN
    RAISE EXCEPTION 'Insufficient coins';
  END IF;

  RETURN v_new_coins;
END;
$$;

CREATE OR REPLACE FUNCTION public.credit_user_coins(p_user_id uuid, p_amount integer)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_coins integer;
BEGIN
  UPDATE public.users
  SET coins = coins + p_amount,
      updated_at = now()
  WHERE id = p_user_id
  RETURNING coins INTO v_new_coins;

  IF v_new_coins IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  RETURN v_new_coins;
END;
$$;

-- Grant execute permission to service role
GRANT EXECUTE ON FUNCTION public.deduct_user_coins(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.credit_user_coins(uuid, integer) TO service_role;
