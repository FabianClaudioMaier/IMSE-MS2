import { initView } from "./view.js";
import { initExplorer } from "./explorer.js";
import { initSeed } from "./seed.js";
import { initMigration } from "./migration.js";
import { initUsecase1 } from "./usecase1.js";
import { initUsecase2 } from "./usecase2.js";
import { initUc1Report } from "./uc1.js";
import { initUc2Report } from "./uc2.js";

const state = {
  usecase1ApiBase: "/api/usecase1",
};

const actions = {};

initExplorer({ actions, state });
initUsecase1({ actions, state });
initUsecase2({ actions, state });
initUc1Report({ actions, state });
initUc2Report({ actions, state });
initSeed({ actions, state });
initMigration({ actions, state });
initView({ actions, state });

actions.loadTables?.();
actions.loadSeedStatus?.();
actions.loadUseCaseCustomers?.();
actions.loadUc1Customers?.();
