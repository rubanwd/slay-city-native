import { callRpc, firstRow, type Db } from "./rpc";

export type StudentLinkResult = Awaited<ReturnType<typeof callRpc<"link_student_by_email">>>[number];
export type StudentHomeworkTopic = Awaited<ReturnType<typeof callRpc<"parent_student_homework">>>[number];

export async function linkStudentByEmail(db: Db, studentEmail: string): Promise<StudentLinkResult> {
  const rows = await callRpc(db, "link_student_by_email", { p_student_email: studentEmail });
  return firstRow(rows, "link_student_by_email");
}

export async function parentStudentHomework(db: Db, studentId: string): Promise<StudentHomeworkTopic[]> {
  return callRpc(db, "parent_student_homework", { p_student_id: studentId });
}
