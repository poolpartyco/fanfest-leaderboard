import { supabase } from './supabase'

// Upsert a single pick. The before-kickoff DB trigger is the source of truth
// for locking; this just surfaces any error message to the UI.
export async function submitPick(
  matchId: string,
  userId: string,
  pickedTeamId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('picks')
    .upsert(
      { match_id: matchId, user_id: userId, picked_team_id: pickedTeamId },
      { onConflict: 'match_id,user_id' },
    )
  return { error: error?.message ?? null }
}
