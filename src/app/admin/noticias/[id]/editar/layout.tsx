import { Metadata } from 'next';
import { SITE_NAME } from '@/lib/constants';

export const metadata: Metadata = {
  title: `Editar Notícia | ${SITE_NAME}`,
  description: 'Edite uma notícia existente',
};

export default function EditNewsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
