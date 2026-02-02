import { supabase } from '../../../../lib/supabase';

export type ActivityPlanDraftRow = {
  id: string;
  owner_user_id: string;
  title: string | null;
  draft_payload: any;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
};

export type SummaryRequestRow = {
  id: string;
  request_no: string;
  request_date: string;
  requested_by_user_id: string;
  status: string;
  linked_draft_id: string | null;
  summary_payload: any;
  totals_by_currency: any;
  created_at: string;
  updated_at: string;
};

export async function upsertDraft(args: {
  draftId?: string | null;
  title?: string | null;
  ownerUserId: string;
  payload: any;
}) {
  if (args.draftId) {
    const { data, error } = await supabase
      .from('activity_plan_drafts')
      .update({ title: args.title || null, draft_payload: args.payload })
      .eq('id', args.draftId)
      .select('*')
      .single();
    if (error) throw error;
    return data as ActivityPlanDraftRow;
  }

  const { data, error } = await supabase
    .from('activity_plan_drafts')
    .insert({ owner_user_id: args.ownerUserId, title: args.title || null, draft_payload: args.payload })
    .select('*')
    .single();
  if (error) throw error;
  return data as ActivityPlanDraftRow;
}

export async function getDraft(draftId: string) {
  const { data, error } = await supabase.from('activity_plan_drafts').select('*').eq('id', draftId).single();
  if (error) throw error;
  return data as ActivityPlanDraftRow;
}

export async function createSummaryRequest(args: {
  requestedByUserId: string;
  linkedDraftId?: string | null;
  summaryPayload: any;
  totalsByCurrency?: any;
}) {
  const { data, error } = await supabase
    .from('procurement_summary_requests')
    .insert({
      requested_by_user_id: args.requestedByUserId,
      linked_draft_id: args.linkedDraftId || null,
      status: 'submitted',
      summary_payload: args.summaryPayload,
      totals_by_currency: args.totalsByCurrency || null,
    })
    .select('id,request_no,request_date,status')
    .single();

  if (error) throw error;
  return data as Pick<SummaryRequestRow, 'id' | 'request_no' | 'request_date' | 'status'>;
}
