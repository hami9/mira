export type ChatFormFieldType = 'text' | 'textarea' | 'email' | 'tel' | 'select' | 'checkbox';
export interface ChatFormField {
  id: string;
  label: string;
  type: ChatFormFieldType;
  required: boolean;
  options?: string[];
}
export interface ChatFormDto {
  id: string;
  title: string;
  description: string;
  fields: ChatFormField[];
  revision: number;
  creatorId: string;
  archivedAt: string | null;
}
export interface SaveChatFormDto {
  title: string;
  description?: string;
  fields: ChatFormField[];
}
export type ChatFormAnswers = Record<string, string | boolean>;
export type ChatToolMetadata =
  | { kind: 'link'; url: string; title: string; description: string; host: string }
  | {
      kind: 'form-request';
      templateId: string;
      revision: number;
      title: string;
      description: string;
      fields: ChatFormField[];
      submittedAt: string | null;
    }
  | {
      kind: 'form-response';
      requestMessageId: string;
      title: string;
      fields?: ChatFormField[];
      answers: ChatFormAnswers;
    };
