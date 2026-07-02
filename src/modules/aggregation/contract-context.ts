import type { RemoteSchool } from '../../infrastructure/clients/ecole.client';
import type { RemoteEmployee } from '../../infrastructure/clients/personnel.client';
import type { RemoteUser } from '../../infrastructure/clients/user.client';
import type { AcademicYear } from '../../infrastructure/clients/academic-year.client';

/**
 * ContractContext: objet agrege et NORMALISE a partir des services sources.
 * Chaque bloc est optionnel; `missingSources` liste les sources indisponibles.
 */
export interface SchoolBlock {
  schoolName?: string;
  schoolLogo?: string;
  schoolAddress?: string;
  city?: string;
  department?: string;
  country?: string;
  schoolPhone?: string;
  schoolEmail?: string;
  schoolWebsite?: string;
  schoolCode?: string;
  timezone?: string;
  directorName?: string;
  directorFunction?: string;
  currency?: string;
}

export interface EmployeeBlock {
  fullName?: string;
  firstName?: string;
  lastName?: string;
  photo?: string;
  gender?: string;
  birthDate?: string;
  nationality?: string;
  idNumber?: string;
  taxNumber?: string;
  address?: string;
  phone?: string;
  email?: string;
  maritalStatus?: string;
  matricule?: string;
  schoolId?: string;
  supervisorId?: string;
}

export interface AssignmentBlock {
  position?: string;
  department?: string;
  schoolId?: string;
  subjects?: string[];
  hierarchicalLink?: string;
  startDate?: string;
  status?: string;
  workHours?: string;
}

export interface ContractContext {
  school?: SchoolBlock;
  employee?: EmployeeBlock;
  assignment?: AssignmentBlock;
  academicYear?: { id: string; name?: string };
  missingSources: string[];
  warnings: string[];
}

// ----- Normalisation source -> bloc -----

export function normalizeSchool(s: RemoteSchool): SchoolBlock {
  const addr = [s.contact?.adresse_ligne1, s.contact?.adresse_ligne2].filter(Boolean).join(', ');
  return {
    schoolName: s.identity?.nom,
    schoolLogo: s.identity?.logo_url,
    schoolAddress: addr || undefined,
    city: s.contact?.ville ?? undefined,
    department: s.contact?.departement,
    country: s.contact?.pays ?? undefined,
    schoolPhone: s.contact?.telephone ?? undefined,
    schoolEmail: s.contact?.email_officiel ?? undefined,
    schoolWebsite: s.contact?.site_web ?? undefined,
    schoolCode: s.meta?.code_ecole,
    timezone: s.contact?.time_zone ?? undefined,
    // director/currency absents du modele ecole -> proxy "contact responsable" + defaut.
    directorName: s.access?.[0]?.contactResponsableNom,
    directorFunction: 'Directeur',
    currency: 'HTG',
  };
}

export function normalizeEmployee(e: RemoteEmployee): EmployeeBlock {
  const fullName = [e.prenom, e.nom].filter(Boolean).join(' ') || undefined;
  const address = [e.adresse, e.ville].filter(Boolean).join(', ') || undefined;
  return {
    fullName,
    firstName: e.prenom,
    lastName: e.nom,
    photo: e.photo_url,
    gender: e.sexe,
    birthDate: e.date_naissance,
    nationality: e.nationalite,
    idNumber: e.document_identite?.numero_carte_identite ?? e.document_identite?.numero_passeport,
    taxNumber: e.document_identite?.numero_fiscal,
    address,
    phone: e.telephone_principal,
    email: e.email_professionnel ?? e.email_personnel,
    maritalStatus: e.etat_civil,
    matricule: e.matricule,
    schoolId: e.ecole_id,
    supervisorId: e.superviseur_academique_id,
  };
}

/** Affectation derivee du dossier personnel (source dediee affectation optionnelle). */
export function assignmentFromEmployee(e: RemoteEmployee): AssignmentBlock {
  return {
    position: e.poste,
    department: e.departement,
    schoolId: e.ecole_id,
    subjects: e.matieres_enseignees,
    startDate: e.date_embauche,
    status: e.statut_professionnel,
    workHours:
      typeof e.heures_enseignement_semaine === 'number'
        ? `${e.heures_enseignement_semaine}h/semaine`
        : undefined,
  };
}

export function supervisorName(u: RemoteUser): string | undefined {
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || undefined;
}

export function academicYearBlock(y: AcademicYear): { id: string; name?: string } {
  return { id: y.id, name: y.name };
}
