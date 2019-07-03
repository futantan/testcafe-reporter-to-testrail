const TestRail = require('./testrail');
const INVALID_ENV = 'Error:  TESTRAIL_HOST, TESTRAIL_USER, TESTRAIL_PASS and PROJECT_NAME must be set as environment variables for the reporter plugin to push the result to the Testrail';

module.exports = function () {
  return {
    noColors:           false,
    startTime:          null,
    afterErrList:       false,
    currentFixtureName: null,
    testCount:          0,
    skipped:            0,
    output:             '',
    testResult:         [],
    agents:             '',
    passed:             '',
    failed:             '',
    testStartTime:      '',
    testEndTime:        '',
    totalTaskTime:      '',
    errorTestData:      [],
    creationDate:       '',
    PlanName:           '',
    PlanID:             0,
    SuiteID:            0,
    Sections:           [],
    EnableTestrail:     false,
    PushTestRuns:       true,
    PushTestCases:      true,
    ProjectID:          0,
    ProjectName:        '',
    TestrailUser:       null,
    TestrailPass:       null,
    TestrailHost:       null,
    ConfigID:           [],

    async reportTaskStart (startTime, userAgents, testCount) {
      this.startTime = new Date(); // set first test start time

      this.testCount = testCount;

      this.setIndent(2)
        .useWordWrap(true)
        .write('--------------------------------------------------------------------')
        .newline()
        .write('|        Running tests in:')
        .write(this.chalk.blue(userAgents))
        .write('|')
        .newline()
        .write('--------------------------------------------------------------------')
        .newline();
      this.agents = userAgents;
      this.testStartTime = new Date();
      this.ProjectName = process.env.PROJECT_NAME;
      this.EnableTestrail = process.env.TESTRAIL_ENABLE === 'true';
      this.PushTestRuns = process.env.PushTestRuns === 'true';
      this.PushTestCases = process.env.PushTestCases === 'true';
      this.TestrailHost = process.env.TESTRAIL_HOST;
      this.TestrailPass = process.env.TESTRAIL_PASS;
      this.TestrailUser = process.env.TESTRAIL_USER;
      if (this.EnableTestrail && (!this.ProjectName || !this.TestrailHost || !this.TestrailPass || !this.TestrailUser)) {
        this.newline().write(this.chalk.red.bold(INVALID_ENV));
        process.exit(1);
      }

      this.PlanName = process.env.PLAN_NAME || 'TestAutomation_1';
    },

    async reportFixtureStart (name) {
      this.currentFixtureName = name;
    },

    async reportTestDone (name, testRunInfo) {
      const _this = this;

      this.testEndTime = new Date(); // set test end time
      const hasErr = testRunInfo.errs.length;
      const result = hasErr ? this.chalk.red('Failed') : this.chalk.green('Passed');

      this.write(result + ' ' + this.currentFixtureName + ' - ' + name).newline();

      this.testStartTime = new Date(); // set net test start time

      const testOutput = {};
      testOutput[0] = this.currentFixtureName;
      testOutput[1] = name;
      testOutput[2] = testRunInfo.skipped ? 'Skipped' : hasErr ? 'Failed' : 'Passed';
      testOutput[3] = this.moment.duration(testRunInfo.durationMs).format('h[h] mm[m] ss[s]');

      if (testRunInfo.skipped) {
        this.skipped++;
      }

      if (hasErr) {
        const error = {};
        error[0] = this.currentFixtureName;
        error[1] = name;
        error[2] = '';
        testOutput[4] = '';
        this._renderErrors(testRunInfo.errs);

        testRunInfo.errs.forEach(function (err, idx) {
          // eslint-disable-next-line
          error[2] += _this.formatError(err, idx + 1 + ') ').replace(/(?:\r\n|\r|\n)/g, '<br />').replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
          // eslint-disable-next-line
          testOutput[4] += _this.formatError(err, idx + 1 + ') ').replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
        });
        this.errorTestData.push(error);
      }
      this.testResult.push(testOutput);
    },

    async reportTaskDone (endTime, passed) {
      this.totalTaskTime = this.moment.duration(endTime - this.startTime).format('h[h] mm[m] ss[s]');

      if (this.skipped > 0) {
        this.write(this.chalk.cyan(this.skipped + ' Skipped')).newline();
      }

      this.passed = passed;
      this.failed = this.testCount - passed;

      const footer = (passed === this.testCount ? this.testCount + ' Passed' : this.testCount - passed + '/' + this.testCount + ' Failed')
        + ' (Duration: ' + this.totalTaskTime + ')';
      this.write(footer).newline();

      const d = new Date();
      this.creationDate = [d.getDate(), d.getMonth() + 1, d.getFullYear(), d.getHours(), d.getMinutes(), d.getSeconds()].join('_');

      this.generateReport();

      if (this.EnableTestrail) {
        this.publishResultToTestrail();
      }
    },

    _renderErrors: function _renderErrors (errs) {
      const that = this;
      this.setIndent(3).newline();
      errs.forEach(function (err, idx) {
        const prefix = that.chalk.red(idx + 1 + ') ');
        that.newline().write(that.formatError(err, prefix)).newline().newline();
      });
    },

    publishResultToTestrail: function publishResultToTestrail () {
      const that = this;

      const resultsTestcases = [];
      const caseidList = [];
      const newCaseList = [];

      this.newline()
        .newline()
        .write('------------------------------------------------------')
        .newline()
        .write(this.chalk.green('Publishing the result to testrail...'));

      for (const testResultItem of this.testResult) {
        // eslint-disable-next-line
        const testDesc = testResultItem[1].split('\|'); // split the Test Description
        let caseID = null;

        if (typeof testDesc[2] === 'undefined') {
          newCaseList.push({ section: testDesc[0].trim(), title: testDesc[1].trim() });
          // verify that Case_ID  of test is present or not
          this.newline().write(this.chalk.red.bold(this.symbols.err)).write('Warning:  Test: ' + testResultItem[1] + ' missing the Testrail ID');
          continue;
        }

        caseID = String(testDesc[2]).toUpperCase().replace('C', ''); // remove the prefix C from CaseID

        //to check that caseID is valid ID using isnumber function
        if (isNaN(caseID)) {
          this.newline().write(this.chalk.red.bold(this.symbols.err)).write('Warning:  Test: ' + testResultItem[1] + ' contains invalid Test rail Case id');
          continue;
        }

        let _status = testResultItem[2];
        let comment = null;

        if (_status === 'Skipped') {
          _status = 6;
          comment = 'Test Skipped';
        }
        else if (_status === 'Passed') {
          _status = 1;
          comment = 'Test passed';
        }
        else {
          _status = 5;
          comment = testResultItem[4]; // if error found for the Test, It will populated in the comment
        }

        const Testresult = {};
        Testresult['case_id'] = caseID.trim();
        Testresult['status_id'] = _status;
        Testresult['comment'] = comment;
        resultsTestcases.push(Testresult);
        caseidList.push(caseID.trim());
      }

      const api = new TestRail({
        host:     this.TestrailHost,
        user:     this.TestrailUser,
        password: this.TestrailPass
      });

      this.getProject(api);
      if (this.ProjectID === 0) return;

      this.getPlanID(api);
      if (this.PlanID === 0) return;

      this.getSuiteID(api);
      if (this.SuiteID === 0) return;

      if (this.PushTestCases) {
        if (newCaseList.length === 0) {
          this.newline().write(this.chalk.red.bold(this.symbols.err)).write('No test cases data found to publish');
        } else {
          this.getSections(api);

          newCaseList.forEach(testCase => {
            that.addSectionIfNotExisting(api, testCase.section, function (err1, response1, sectionResult) {
              if (err1 !== null) {
                that.newline().write(that.chalk.blue('---------Error at Add Section -----')).write(testCase.section).newline().write(err1);
              } else {
                const steps = [
                  {
                    content:  'Step 1',
                    expected: 'Expected Result 1'
                  },
                  {
                    content:  'Step 2',
                    expected: 'Expected Result 2'
                  }
                ];
                that.addCaseIfNotExisting(api, sectionResult.id, testCase.title, steps, function (err2, response2, caseResult) {
                  const testCaseDesc = sectionResult.name + ' | ' + testCase.title;
                  if (err2 !== null) {
                    that.newline().write(that.chalk.blue('---------Error at Add Case -----')).write(testCaseDesc).newline().write(err2);
                  } else {
                    that.newline().write(that.chalk.blue('Section | Test case (id)')).write(that.chalk.yellow(testCaseDesc + '(' + caseResult.id + ')')).newline();
                  }
                });
              }
            });
          });
        }
      }

      if (this.PushTestRuns) {
        if (caseidList.length === 0) {
          this.newline().write(this.chalk.red.bold(this.symbols.err)).write('No test runs data found to publish');
          return;
        }

        caseidList.forEach(id => api.updateCaseTypeToAutomatedIfNecessary(id));

        const AgentDetails = this.agents[0].split('/');
        const rundetails = {
          'suite_id':    this.SuiteID,
          'include_all': false,
          'case_ids':    caseidList,
          'name':        'Run_' + this.creationDate + '(' + AgentDetails[0] + '_' + AgentDetails[1] + ')'
        };
        let runId = null;
        let result = null;
        api.addPlanEntry(this.PlanID, rundetails, function (err, response, run) {
          if (err !== 'null') {
            runId = run.runs[0].id;
            that.newline().write('------------------------------------------------------').newline().write(that.chalk.green('Run added successfully.')).newline().write(that.chalk.blue.bold('Run name   ')).write(that.chalk.yellow('Run_' + that.creationDate + '(' + AgentDetails[0] + '_' + AgentDetails[1] + ')'));

            result = {
              results: resultsTestcases
            };

            api.addResultsForCases(runId, result, function (err1, response1, results) {
              if (err1 === 'null') {
                that.newline().write(that.chalk.blue('---------Error at Add result -----')).newline().write(err1);
              } else if (results.length === 0) {
                that.newline().write(that.chalk.red('No Data has been published to Testrail.')).newline().write(err1);
              } else {
                that.newline().write('------------------------------------------------------').newline().write(that.chalk.green('Result added to the testrail Successfully'));
              }
            });
          } else {
            that.newline().write(that.chalk.blue('-------------Error at AddPlanEntry ----------------')).newline().write(err);
          }
        });
      }
    },

    getProject: function getProject (api) {
      const that = this;

      api.getProjects(function (err, response, project) {
        if (err !== 'null' && typeof project !== 'undefined') {
          project.forEach(aProject => {
            if (aProject.name === String(that.ProjectName)) {
              that.ProjectID = aProject.id;
              that.newline().write(that.chalk.blue.bold('Project name(id) ')).write(that.chalk.yellow(that.ProjectName + '(' + aProject.id + ')'));
            }
          });
        } else {
          that.newline().write(that.chalk.blue('-------------Error at Get Projects  ----------------')).newline();
          console.log(err);
          that.ProjectID = 0;
        }
      });
    },

    getPlanID: function getPlanID (api) {
      const that = this;
      api.getPlans(this.ProjectID, function (err, response, plans) {
        let planId = '';
        if (err !== 'null') {
          for (const index in plans) {
            if (plans[index].name === that.PlanName) {
              that.newline().write(that.chalk.blue.bold('Plan name(id) ')).write(that.chalk.yellow(plans[index].name + '(' + plans[index].id + ')'));
              planId = plans[index].id;
              break;
            }
          }
          if (planId === '') {
            that.addNewPlan(api);
          } else {
            that.PlanID = planId;
          }
        } else {
          that.newline().write(that.chalk.blue('-------------Error at Get Plans  ----------------')).newline();
          console.log(err);
          that.PlanID = 0;
        }
      });
    },

    addNewPlan: function addNewPlan (api) {
      const that = this;

      api.addPlan(this.ProjectID, {
        name:       this.PlanName,
        desription: 'Added From Automation reporter plugin'
      }, function (err, response, plan) {
        if (err !== 'null') {
          if (typeof plan.id === 'undefined') {
            that.newline().write(that.chalk.red('Plan Id found as undefined'));
            that.PlanID = 0;
          } else {
            that.newline().write(that.chalk.green('New Plan is created')).newline().write(that.chalk.blue.bold('Plan name(id) ')).write(that.chalk.yellow(plan.name + '(' + plan.id + ')'));
            that.PlanID = plan.id;
          }
        } else {
          that.newline().write(that.chalk.blue('-------------Error at Add New Plan  ----------------')).newline();
          console.log(err);
          that.PlanID = 0;
        }
      });
    },

    getSuiteID: function getSuiteID (api) {
      const that = this;

      return api.getSuites(this.ProjectID, function (err, response, suites) {
        if (err !== 'null') {
          if (suites.length === 0) {
            that.newline().write(that.chalk.red('The project doesnt contain any suite'));
            that.SuiteID = 0;
          } else {
            const id = suites[0].id;
            that.newline().write(that.chalk.blue.bold('Suite name(id) ')).write(that.chalk.yellow(suites[0].name + '(' + id + ')'));
            that.SuiteID = id;
          }
        } else {
          that.newline().write(that.chalk.blue('-------------Error at Get Suites  ----------------')).newline();
          console.log(err);
          that.SuiteID = 0;
        }
      });
    },

    getSections: function getSections (api) {
      const that = this;

      return api.getSections(this.ProjectID, { suite_id: this.SuiteID }, function (err, response, sections) {
        if (err !== null) {
          that.newline().write(that.chalk.blue('---------Error at Get Sections -----')).newline().write(err);
        } else {
          that.Sections = sections;
        }
      });
    },

    addSectionIfNotExisting: function addSectionIfNotExisting (api, section, callback) {
      const existingSection = this.Sections.filter(existing => existing.name === section)[0];

      if (typeof existingSection === 'undefined') {
        return api.addSection(this.ProjectID, { suite_id: this.SuiteID, name: section }, callback);
      }
      return callback(null, existingSection, existingSection);
    },

    addCaseIfNotExisting: function addCaseIfNotExisting (api, sectionId, title, steps, callback) {
      return api.getCases(this.ProjectID, { suite_id: this.SuiteID, section_id: sectionId }, function (err, response, result) {
        const existingTestCase = result.filter(testcase => testcase.title === title)[0];
        if (typeof existingTestCase === 'undefined') {
          const caseData = {
            title,
            type_id:                api.CONSTANTS.TYPE_AUTOMATED,
            priority_id:            api.CONSTANTS.PRIORITY_MEDIUM,
            template_id:            api.CONSTANTS.TEMPLATE_STEPS,
            custom_steps_separated: steps
          };
          return api.addCase(sectionId, caseData, callback);
        }
        return callback(null, existingTestCase, existingTestCase);
      });

    },

    generateReport: function generateReport () {
      this.output += '<!DOCTYPE html>\n\t\t\t\t\t\t\t<html>\n                            <head>\n                            <title>TestCafe HTML Report</title>\n                            <script src=\'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/2.7.2/Chart.min.js\'></script>\n                            <meta name=\'viewport\' content=\'width=device-width, initial-scale=1\'>\n                            <link rel=\'stylesheet\' href=\'https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css\'>\n                            <script src=\'https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/js/bootstrap.min.js\'></script>\n                            <script>\n                            var config = {             type: \'pie\',             data: {                 datasets: [{                     data: [                         \'' + this.passed + '\',\'' + this.failed + '\'                     ],                     backgroundColor: [                         \'Green\',                         \'Red\'                     ]                 }],                 labels: [                     \'Pass\',                     \'Failed\'                 ]             },             options: {                 responsive: true             }         };          window.onload = function() {             var ctx = document.getElementById(\'myChart\').getContext(\'2d\');             window.myPie = new Chart(ctx, config);         }; \n                            </script>\n                            </head>\n                            <body>\n                            <div class=\'container-fluid\'>\n                                <div class="row">\n                            <div class="col-sm-8">\n                                  <div>\n                                  <canvas id=\'myChart\' height=\'80\' ></canvas>\n                                  </div>\n                            </div>\n                            <div class="col-sm-2" style=" padding-top:80px">\n                                <table class=\'table table-bordered\' >\n                                <tr>\n                                    <td><b>Passed</b></td>\n                                    <td> ' + this.passed + ' </td>\n                                </tr>\n                                <tr>\n                                    <td> <b>Failed </b></td>\n                                    <td> ' + this.failed + ' </td>\n                                </tr>\n                                <tr>\n                                    <td> <b>Skipped </b></td>\n                                    <td> ' + this.skipped + ' </td>\n                                </tr>\n                                <tr class=\'info\'>\n                                    <td> <b>Total </b></td>\n                                    <td> ' + (this.testCount + this.skipped) + ' </td>\n                                </tr>\n                                </table>\n                            </div>\n                          </div>\n                            <hr/>\n                            \n                            \n                            <h4>Running tests in: <b>' + this.agents + '</b>                      <span> Total Time: ' + this.totalTaskTime + '</span></h4>\n                            <hr/><br/>\n                                <h3 style=\'font-color:red\'> Test details</h3>\n                                <table class=\'table table-bordered table-hover\'>\n                                <thead>\n                                <tr>\n                                    <th> Fixture Name </th>\n                                    <th> Test Name </th>\n                                    <th> Status </th>\n                                    <th> Time </th>\n                                </tr> </thead><tbody>';

      for (var index in this.testResult) {
        var status = this.testResult[index][2];

        if (status === 'Skipped') status = '<td style=\'background-color:gray\' >Skipped</td>'; else if (status === 'Passed') status = '<td style=\'background-color:green\' >Passed</td>'; else status = '<td style=\'background-color:red\' >Failed</td>';

        this.output += '<tr>\n                                <td>' + this.testResult[index][0] + '</td>\n                                <td>' + this.testResult[index][1] + '</td>\n                                ' + status + '\n                                <td style=\'padding-right:0px;border-right:0px;\'>' + this.testResult[index][3] + '</td>\n                            </tr>';
      }

      this.output += '</tbody></table><hr /> <br />';

      this.output += '<h3 style=\'font-color:red\'> Error details</h3><br /><table class=\'table table-bordered table-hover\'><thead>\n                                <tr>\n                                    <th> Fixture Name </th>\n                                    <th> Test Name </th>\n                                    <th> Error </th>\n                                </tr></thead><tbody>';

      for (var i in this.errorTestData)
        this.output += '<tr>\n                                <td>' + this.errorTestData[i][0] + '</td>\n                                <td>' + this.errorTestData[i][1] + '</td>\n                                <td>' + this.errorTestData[i][2] + '</td>\n                                </tr>';


      this.output += '</tbody></table>\n                           </body>\n                         </html>';
      var fs = require('fs');

      // eslint-disable-next-line
      var dir = process.env.HTML_REPORT_PATH || __dirname + '../../../../TestResult';

      if (!fs.existsSync(dir)) {
        var dirName = '';
        var filePathSplit = dir.split('/');

        for (var _index = 0; _index < filePathSplit.length; _index++) {
          dirName += filePathSplit[_index] + '/';
          if (!fs.existsSync(dirName)) fs.mkdirSync(dirName);
        }
      }

      var filename = 'Report_' + this.creationDate + '.html';

      if (typeof process.env.HTML_REPORT_NAME !== 'undefined')
        filename = process.env.HTML_REPORT_NAME + '.html';


      var file = dir + '/' + filename;

      if (typeof process.env.HTML_REPORT_PATH !== 'undefined')
        file = process.env.HTML_REPORT_PATH + ('/' + filename);


      var isError = false;

      fs.writeFile(file, this.output, function (err) {
        if (err) {
          isError = true;
          return console.log(err);
        }
      });
      if (!isError)
        this.newline().write('------------------------------------------------------').newline().newline().write(this.chalk.green('The file was saved at')).write(this.chalk.yellow(file));

    }
  };
};
