import { ReferralsDepartmentWorkspace } from '../referrals/ReferralsDepartmentWorkspace'

export default function LabWorkspace() {
  return (
    <ReferralsDepartmentWorkspace
      department="lab"
      title="المخبر"
      subtitle="التحويلات القادمة من العيادات — نفّذ التحاليل المطلوبة ثم أدخل النتائج قبل الإكمال (تحديث لحظي)."
      requireLabResultsOnComplete
    />
  )
}
