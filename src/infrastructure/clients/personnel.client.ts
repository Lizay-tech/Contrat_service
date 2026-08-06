import { env } from '../../shared/config/env';
import { getJson } from './http-client';

/**
 * Client enseignant/personnel-service. Route reelle: GET /api/teachers/:id
 * Enveloppe { success, data }. Champs snake_case PLATS. Ce service porte deja
 * poste/departement/ecole_id/superviseur -> il couvre une partie de l'affectation.
 */
export interface RemoteEmployee {
  id: string;
  matricule?: string;
  nom?: string;
  prenom?: string;
  deuxieme_prenom?: string;
  sexe?: string;
  date_naissance?: string;
  lieu_naissance?: string;
  nationalite?: string;
  etat_civil?: string;
  photo_url?: string;
  document_identite?: {
    numero_carte_identite?: string;
    numero_passeport?: string;
    numero_fiscal?: string;
  };
  telephone_principal?: string;
  telephone_secondaire?: string;
  email_professionnel?: string;
  email_personnel?: string;
  adresse?: string;
  ville?: string;
  pays?: string;
  contact_urgence?: { nom?: string; relation?: string; telephone?: string };
  date_embauche?: string;
  type_contrat?: string;
  poste?: string;
  departement?: string;
  statut_professionnel?: string;
  heures_enseignement_semaine?: number;
  matieres_enseignees?: string[];
  ecole_id?: string;
  superviseur_academique_id?: string;
}

export async function getEmployee(
  id: string,
  token?: string | null,
): Promise<RemoteEmployee | null> {
  return getJson<RemoteEmployee>(`${env.clients.personnelUrl}/api/teachers/${id}`, {
    token: token ?? null,
    cacheKey: `personnel:${id}`,
    ttlSeconds: 60,
  });
}
