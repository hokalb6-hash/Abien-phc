import { ER_COMPLETION_SERVICES } from '../../constants/erServices'
import { ReferralsDepartmentWorkspace } from '../referrals/ReferralsDepartmentWorkspace'

export default function ERWorkspace() {
  return (
    <ReferralsDepartmentWorkspace
      department="er"
      title="الإسعاف والطوارئ"
      subtitle="تحويلات من العيادات أو زيارة مباشرة من الطوارئ — سجّل الخدمة المقدّمة ثم أكمِل الملف."
      completionServiceCatalog={ER_COMPLETION_SERVICES}
    />
  )
}
