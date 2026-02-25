import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from './firebaseConfig';

export interface Program {
  id: string;
  title: string;
  description: string;
  platform: string;
  version?: string;
  fileUrl: string;
  iconUrl: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export async function fetchPrograms(): Promise<Program[]> {
  const programsRef = collection(db, 'programs');
  const q = query(programsRef, orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data() as Omit<Program, 'id'>;
    return { id: docSnap.id, ...data };
  });
}

interface CreateProgramInput {
  title: string;
  description: string;
  platform: string;
  version?: string;
  fileUrl: string;
  iconUrl: string;
}

export async function createProgram(input: CreateProgramInput): Promise<void> {
  const programsRef = collection(db, 'programs');
  const newDocRef = doc(programsRef);

  await setDoc(newDocRef, {
    title: input.title,
    description: input.description,
    platform: input.platform,
    version: input.version ?? '',
    fileUrl: input.fileUrl,
    iconUrl: input.iconUrl,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateProgram(
  programId: string,
  input: CreateProgramInput
): Promise<void> {
  const docRef = doc(db, 'programs', programId);
  await updateDoc(docRef, {
    title: input.title,
    description: input.description,
    platform: input.platform,
    version: input.version ?? '',
    fileUrl: input.fileUrl,
    iconUrl: input.iconUrl,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProgram(program: Program): Promise<void> {
  const docRef = doc(db, 'programs', program.id);
  await deleteDoc(docRef);
  // Files in Storage are not deleted automatically to keep the code simple.
  // You can remove them manually from Firebase console if needed.
}

