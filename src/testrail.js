// ----- API Reference: http://docs.gurock.com/testrail-api2/start -----

const request = require('request');
const qs = require('querystring');
const Promise = require('bluebird');

function TestRail (options) {
  this.host = options.host;
  this.user = options.user;
  this.password = options.password;

  this.uri = '/index.php?/api/v2/';
}


/////////////////////// Customise begin//////////////////////////////////
const TYPE_AUTOMATED = 3;
const PRIORITY_MEDIUM = 2;
const TEMPLATE_STEPS = 2;
TestRail.prototype.updateCaseTypeToAutomatedIfNecessary = function (caseId) {
  const updateCaseTypeToAutomated = () => {
    this.updateCase(caseId, { type_id: TYPE_AUTOMATED }, () => {});
  };

  this.getCase(caseId, (err, response, caseObj) => {
    if (err) { return; }
    if (caseObj.type_id !== TYPE_AUTOMATED) {
      updateCaseTypeToAutomated();
    }
  });
};

TestRail.prototype.addSectionIfNotExisting = function (projectId, suiteID, existingSections, section, callback) {
  const existingSection = existingSections.filter(existing => existing.name === section)[0];

  if (typeof existingSection === 'undefined') {
    return this.addSection(projectId, { name: section, suite_id: suiteID }, callback);
  }
  return callback(null, existingSection, existingSection);
};

TestRail.prototype.addCaseIfNotExisting = function (sectionId, title, callback) {
  const caseData = {
    title,
    type_id:                TYPE_AUTOMATED,
    priority_id:            PRIORITY_MEDIUM,
    template_id:            TEMPLATE_STEPS,
    custom_steps_separated: [
      {
        content:  'Step 1',
        expected: 'Expected Result 1'
      },
      {
        content:  'Step 2',
        expected: 'Expected Result 2'
      }]
  };
  return this.addCase(sectionId, caseData, callback);
};


/////////////////////// Customise end  //////////////////////////////////

TestRail.prototype.apiGet = function (apiMethod, queryVariables, callback) {
  var url = this.host + this.uri + apiMethod;

  if (typeof queryVariables === 'function') {
    callback = queryVariables;
    queryVariables = null;
  }

  return this._callAPI('get', url, queryVariables, null, callback);
};

TestRail.prototype.apiPost = function (apiMethod, body, queryVariables, callback) {
  var url = this.host + this.uri + apiMethod;

  if (typeof body === 'function') {
    callback = body;
    queryVariables = body = null;
  }
  else if (typeof queryVariables === 'function') {
    callback = queryVariables;
    queryVariables = null;
  }

  return this._callAPI('post', url, queryVariables, body, callback);
};

TestRail.prototype._callAPI = function (method, url, queryVariables, body, callback) {
  if (queryVariables !== null)
    url += '&' + qs.stringify(queryVariables);


  var requestArguments = {
    uri:     url,
    headers: {
      'content-type': 'application/json',
      'accept':       'application/json'
    },
    rejectUnauthorized: false
  };

  if (body !== null) {
    requestArguments.body = body;
  }

  var bool = false;

  if (typeof callback === 'function') {
    var data = request[method](requestArguments, function (err, res, respBody) {
      bool = true;
      if (err) {
        return callback(err);
      }

      var responseBody = respBody === '' ? JSON.stringify({}) : respBody;

      if (res.statusCode !== 200) {
        var errData = respBody;

        try {
          errData = JSON.parse(respBody);
        } catch (parseErr) {
          return callback(parseErr.message || parseErr);
        }
        return callback(errData, res);
      }
      return callback(null, res, JSON.parse(responseBody));
    }).auth(this.user, this.password, true);

    require('deasync').loopWhile(function () {
      return !bool;
    });
    return data;
  }
  return new Promise(function (resolve, reject) {
    return request[method](requestArguments, function (err, res, respBody) {
      if (err)
        return reject(err);

      var responseBody = respBody === '' ? JSON.stringify({}) : respBody;

      if (res.statusCode !== 200) {
        var errData = respBody;

        try {
          errData = JSON.parse(respBody);
        } catch (parseErr) {
          return callback(parseErr.message || parseErr);
        }
        return reject({ message: errData, response: res });
      }
      return resolve({ response: res, body: JSON.parse(responseBody) });
    }).auth(this.user, this.password, true);
  }.bind(this));

};

// ----- Cases -----

TestRail.prototype.getCase = function (id, callback) {
  return this.apiGet('get_case/' + id, callback);
};

TestRail.prototype.getCases = function (projectId, filters, callback) {
  var uri = 'get_cases/' + projectId;

  if (typeof filters === 'function') {
    callback = filters;
    return this.apiGet(uri, callback);
  }
  return this.apiGet(uri, filters, callback);

};

TestRail.prototype.addCase = function (sectionId, data, callback) {
  return this.apiPost('add_case/' + sectionId, JSON.stringify(data), callback);
};

TestRail.prototype.updateCase = function (caseId, data, callback) {
  return this.apiPost('update_case/' + caseId, JSON.stringify(data), callback);
};

TestRail.prototype.deleteCase = function (caseId, callback) {
  return this.apiPost('delete_case/' + caseId, callback);
};

// ----- Case Fields -----

TestRail.prototype.getCaseFields = function (callback) {
  return this.apiGet('get_case_fields', callback);
};

// ----- Case Types -----

TestRail.prototype.getCaseTypes = function (callback) {
  return this.apiGet('get_case_types', callback);
};

// ----- Configurations -----

TestRail.prototype.getConfigs = function (projectId, callback) {
  return this.apiGet('get_configs/' + projectId, callback);
};

TestRail.prototype.addConfigGroup = function (projectId, data, callback) {
  return this.apiPost('add_config_group/' + projectId, JSON.stringify(data), callback);
};

TestRail.prototype.addConfig = function (configGroupId, data, callback) {
  return this.apiPost('add_config/' + configGroupId, JSON.stringify(data), callback);
};

TestRail.prototype.updateConfigGroup = function (configGroupId, data, callback) {
  return this.apiPost('update_config_group/' + configGroupId, JSON.stringify(data), callback);
};

TestRail.prototype.updateConfig = function (configId, data, callback) {
  return this.apiPost('update_config/' + configId, JSON.stringify(data), callback);
};

TestRail.prototype.deleteConfigGroup = function (configGroupId, callback) {
  return this.apiPost('delete_config_group/' + configGroupId, callback);
};

TestRail.prototype.deleteConfig = function (configId, callback) {
  return this.apiPost('delete_config/' + configId, callback);
};

// ----- Milestones -----

TestRail.prototype.getMilestone = function (id, callback) {
  return this.apiGet('get_milestone/' + id, callback);
};

TestRail.prototype.getMilestones = function (projectId, filters, callback) {
  var uri = 'get_milestones/' + projectId;

  if (typeof filters === 'function') {
    callback = filters;
    return this.apiGet(uri, callback);
  }
  return this.apiGet(uri, filters, callback);

};

TestRail.prototype.addMilestone = function (projectId, data, callback) {
  return this.apiPost('add_milestone/' + projectId, JSON.stringify(data), callback);
};

TestRail.prototype.updateMilestone = function (milestoneId, data, callback) {
  return this.apiPost('update_milestone/' + milestoneId, JSON.stringify(data), callback);
};

TestRail.prototype.deleteMilestone = function (milestoneId, callback) {
  return this.apiPost('delete_milestone/' + milestoneId, callback);
};

// ----- Plans -----

TestRail.prototype.getPlan = function (id, callback) {
  return this.apiGet('get_plan/' + id, callback);
};

TestRail.prototype.getPlans = function (projectId, filters, callback) {
  var uri = 'get_plans/' + projectId;

  if (typeof filters === 'function') {
    callback = filters;
    return this.apiGet(uri, callback);
  }
  return this.apiGet(uri, filters, callback);

};

TestRail.prototype.addPlan = function (projectId, data, callback) {
  return this.apiPost('add_plan/' + projectId, JSON.stringify(data), callback);
};

TestRail.prototype.addPlanEntry = function (planId, data, callback) {
  return this.apiPost('add_plan_entry/' + planId, JSON.stringify(data), callback);
};

TestRail.prototype.updatePlan = function (planId, data, callback) {
  return this.apiPost('update_plan/' + planId, JSON.stringify(data), callback);
};

TestRail.prototype.updatePlanEntry = function (planId, entryId, data, callback) {
  return this.apiPost('update_plan_entry/' + planId + '/' + entryId, JSON.stringify(data), callback);
};

TestRail.prototype.closePlan = function (planId, callback) {
  return this.apiPost('close_plan/' + planId, callback);
};

TestRail.prototype.deletePlan = function (planId, callback) {
  return this.apiPost('delete_plan/' + planId, callback);
};

TestRail.prototype.deletePlanEntry = function (planId, entryId, callback) {
  return this.apiPost('delete_plan_entry/' + planId + '/' + entryId, callback);
};

// ----- Priorities -----

TestRail.prototype.getPriorities = function (callback) {
  return this.apiGet('get_priorities', callback);
};

// ----- Projects -----

TestRail.prototype.getProject = function (id, callback) {
  return this.apiGet('get_project/' + id, callback);
};

TestRail.prototype.getProjects = function (filters, callback) {
  var uri = 'get_projects';

  if (typeof filters === 'function') {
    callback = filters;
    return this.apiGet(uri, callback);
  }
  return this.apiGet(uri, filters, callback);

};

TestRail.prototype.addProject = function (data, callback) {
  return this.apiPost('add_project', JSON.stringify(data), callback);
};

TestRail.prototype.updateProject = function (projectId, data, callback) {
  return this.apiPost('update_project/' + projectId, JSON.stringify(data), callback);
};

TestRail.prototype.deleteProject = function (projectId, callback) {
  return this.apiPost('delete_project/' + projectId, callback);
};

// ----- Results -----

TestRail.prototype.getResults = function (testId, filters, callback) {
  var uri = 'get_results/' + testId;

  if (typeof filters === 'function') {
    callback = filters;
    return this.apiGet(uri, callback);
  }
  return this.apiGet(uri, filters, callback);

};

TestRail.prototype.getResultsForCase = function (runId, caseId, filters, callback) {
  var uri = 'get_results_for_case/' + runId + '/' + caseId;

  if (typeof filters === 'function') {
    callback = filters;
    return this.apiGet(uri, callback);
  }
  return this.apiGet(uri, filters, callback);

};

TestRail.prototype.getResultsForRun = function (runId, filters, callback) {
  var uri = 'get_results_for_run/' + runId;

  if (typeof filters === 'function') {
    callback = filters;
    return this.apiGet(uri, callback);
  }
  return this.apiGet(uri, filters, callback);

};

TestRail.prototype.addResult = function (testId, data, callback) {
  return this.apiPost('add_result/' + testId, JSON.stringify(data), callback);
};

TestRail.prototype.addResultForCase = function (runId, caseId, data, callback) {
  return this.apiPost('add_result_for_case/' + runId + '/' + caseId, JSON.stringify(data), callback);
};

TestRail.prototype.addResults = function (runId, data, callback) {
  return this.apiPost('add_results/' + runId, JSON.stringify(data), callback);
};

TestRail.prototype.addResultsForCases = function (runId, data, callback) {
  return this.apiPost('add_results_for_cases/' + runId, JSON.stringify(data), callback);
};

// ----- Result Fields -----

TestRail.prototype.getResultFields = function (callback) {
  return this.apiGet('get_result_fields', callback);
};

// ----- Runs -----

TestRail.prototype.getRun = function (id, callback) {
  return this.apiGet('get_run/' + id, callback);
};

TestRail.prototype.getRuns = function (projectId, filters, callback) {
  var uri = 'get_runs/' + projectId;

  if (typeof filters === 'function') {
    callback = filters;
    return this.apiGet(uri, callback);
  }
  return this.apiGet(uri, filters, callback);

};

TestRail.prototype.addRun = function (projectId, data, callback) {
  return this.apiPost('add_run/' + projectId, JSON.stringify(data), callback);
};

TestRail.prototype.updateRun = function (runId, data, callback) {
  return this.apiPost('update_run/' + runId, JSON.stringify(data), callback);
};

TestRail.prototype.closeRun = function (runId, callback) {
  return this.apiPost('close_run/' + runId, callback);
};

TestRail.prototype.deleteRun = function (runId, callback) {
  return this.apiPost('delete_run/' + runId, callback);
};

// ----- Sections -----

TestRail.prototype.getSection = function (id, callback) {
  return this.apiGet('get_section/' + id, callback);
};

TestRail.prototype.getSections = function (projectId, filters, callback) {
  var uri = 'get_sections/' + projectId;
  if (typeof filters === 'function') {
    callback = filters;
    return this.apiGet(uri, callback);
  }
  return this.apiGet(uri, filters, callback);

};

TestRail.prototype.addSection = function (projectId, data, callback) {
  return this.apiPost('add_section/' + projectId, JSON.stringify(data), callback);
};

TestRail.prototype.updateSection = function (sectionId, data, callback) {
  return this.apiPost('update_section/' + sectionId, JSON.stringify(data), callback);
};

TestRail.prototype.deleteSection = function (sectionId, callback) {
  return this.apiPost('delete_section/' + sectionId, callback);
};

// ----- Statuses -----

TestRail.prototype.getStatuses = function (callback) {
  return this.apiGet('get_statuses', callback);
};

// ----- Suites -----

TestRail.prototype.getSuite = function (id, callback) {
  return this.apiGet('get_suite/' + id, callback);
};

TestRail.prototype.getSuites = function (projectId, callback) {
  return this.apiGet('get_suites/' + projectId, callback);
};

TestRail.prototype.addSuite = function (projectId, data, callback) {
  return this.apiPost('add_suite/' + projectId, JSON.stringify(data), callback);
};

TestRail.prototype.updateSuite = function (suiteId, data, callback) {
  return this.apiPost('update_suite/' + suiteId, JSON.stringify(data), callback);
};

TestRail.prototype.deleteSuite = function (suiteId, callback) {
  return this.apiPost('delete_suite/' + suiteId, callback);
};

// ----- Templates -----

TestRail.prototype.getTemplates = function (projectId, callback) {
  return this.apiGet('get_templates/' + projectId, callback);
};

// ----- Tests -----

TestRail.prototype.getTest = function (id, callback) {
  return this.apiGet('get_test/' + id, callback);
};

TestRail.prototype.getTests = function (runId, filters, callback) {
  var uri = 'get_tests/' + runId;

  if (typeof filters === 'function') {
    callback = filters;
    return this.apiGet(uri, callback);
  } return this.apiGet(uri, filters, callback);
};

// ----- Users -----

TestRail.prototype.getUser = function (id, callback) {
  return this.apiGet('get_user/' + id, callback);
};

TestRail.prototype.getUserByEmail = function (email, callback) {
  return this.apiGet('get_user_by_email', { email: email }, callback);
};

TestRail.prototype.getUsers = function (callback) {
  return this.apiGet('get_users', callback);
};

module.exports = TestRail;
