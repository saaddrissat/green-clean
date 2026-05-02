export type CompanySettings = {
  companyName: string;
};

// TODO: remplacer par lecture DB depuis module Parametres.
export const getCompanySettings = (): CompanySettings => ({
  companyName: "Blanchisserie Green Clean",
});
