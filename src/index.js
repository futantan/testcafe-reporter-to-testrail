const TestRail = require('./testrail');

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
    EnableTestrail:     false,
    ProjectID:          0,
    ProjectName:        '',
    TestrailUser:       null,
    TestrailPass:       null,
    TestrailHost:       null,
    ConfigID:           [],

    reportTaskStart: function reportTaskStart (startTime, userAgents, testCount) {
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
      this.TestrailHost = process.env.TESTRAIL_HOST;
      this.TestrailPass = process.env.TESTRAIL_PASS;
      this.TestrailUser = process.env.TESTRAIL_USER;
      if (this.EnableTestrail && (!this.ProjectName || !this.TestrailHost || !this.TestrailPass || !this.TestrailUser)) {
        this.newline().write(this.chalk.red.bold('Error:  TESTRAIL_HOST, TESTRAIL_USER, TESTRAIL_PASS and PROJECT_NAME must be set as environment variables for the reporter plugin to push the result to the Testrail'));
        process.exit(1);
      }

      this.PlanName = process.env.PLAN_NAME || 'TestAutomation_1';
    },

    reportFixtureStart: function reportFixtureStart (name) {

      this.currentFixtureName = name;
    },

    reportTestDone: function reportTestDone (name, testRunInfo) {
      var _this = this;

      this.testEndTime = new Date(); // set test end time
      var hasErr = testRunInfo.errs.length;
      var result = hasErr === 0 ? this.chalk.green('Passed') : this.chalk.red('Failed');

      var namef = this.currentFixtureName + ' - ' + name;

      var title = result + ' ' + namef;

      this.write(title).newline();
      var testOutput = {};

      this.testStartTime = new Date(); // set net test start time
      var testStatus = '';

      if (testRunInfo.skipped) testStatus = 'Skipped'; else if (hasErr === 0) testStatus = 'Passed'; else testStatus = 'Failed';

      testOutput[0] = this.currentFixtureName;
      testOutput[1] = name;
      testOutput[2] = testStatus;
      testOutput[3] = this.moment.duration(testRunInfo.durationMs).format('h[h] mm[m] ss[s]');
      var error = {};

      if (testRunInfo.skipped) this.skipped++;

      if (hasErr > 0) {
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

    reportTaskDone: function reportTaskDone (endTime, passed) {
      var durationMs = endTime - this.startTime;

      var durationStr = this.moment.duration(durationMs).format('h[h] mm[m] ss[s]');

      this.totalTaskTime = durationStr;
      var footer = passed === this.testCount ? this.testCount + ' Passed' : this.testCount - passed + '/' + this.testCount + ' Failed';

      footer += ' (Duration: ' + durationStr + ')';

      if (this.skipped > 0)
        this.write(this.chalk.cyan(this.skipped + ' Skipped')).newline();


      this.passed = passed;
      this.failed = this.testCount - passed;

      this.write(footer).newline();

      var d = new Date();

      this.creationDate = d.getDate() + '_' + (d.getMonth() + 1) + '_' + d.getFullYear() + '_' + d.getHours() + '_' + d.getMinutes() + '_' + d.getSeconds();

      this.generateReport();

      if (this.EnableTestrail)
        this.publishResultToTestrail();

    },

    _renderErrors: function _renderErrors (errs) {
      var _this2 = this;

      this.setIndent(3).newline();

      errs.forEach(function (err, idx) {
        var prefix = _this2.chalk.red(idx + 1 + ') ');

        _this2.newline().write(_this2.formatError(err, prefix)).newline().newline();
      });
    },

    publishResultToTestrail: function publishResultToTestrail () {
      var _this3 = this;

      var resultsTestcases = [];
      var caseidList = [];

      this.newline().newline().write('------------------------------------------------------').newline().write(this.chalk.green('Publishing the result to testrail...'));

      for (var index in this.testResult) {
        // eslint-disable-next-line
        var testDesc = this.testResult[index][1].split('\|'); // split the Test Description
        var caseID = null;

        if (typeof testDesc[2] === 'undefined') {
          // verify that Case_ID  of test is present or not
          this.newline().write(this.chalk.red.bold(this.symbols.err)).write('Warning:  Test: ' + this.testResult[index][1] + ' missing the Testrail ID');
          continue;
        }

        caseID = String(testDesc[2]).toUpperCase().replace('C', ''); // remove the prefix C from CaseID

        //to check that caseID is valid ID using isnumber function
        if (isNaN(caseID)) {
          this.newline().write(this.chalk.red.bold(this.symbols.err)).write('Warning:  Test: ' + this.testResult[index][1] + ' contains invalid Test rail Case id');
          continue;
        }

        var _status = this.testResult[index][2];
        var comment = null;

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
          comment = this.testResult[index][4]; // if error found for the Test, It will populated in the comment
        }

        var Testresult = {};

        Testresult['case_id'] = caseID.trim();
        Testresult['status_id'] = _status;
        Testresult['comment'] = comment;
        resultsTestcases.push(Testresult);
        caseidList.push(caseID.trim());
      }

      if (caseidList.length === 0) {
        this.newline().write(this.chalk.red.bold(this.symbols.err)).write('No test case data found to publish');
        return;
      }

      var api = new TestRail({
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

      var AgentDetails = this.agents[0].split('/');
      var rundetails = {
        'suite_id':    this.SuiteID,
        'include_all': false,
        'case_ids':    caseidList,
        'name':        'Run_' + this.creationDate + '(' + AgentDetails[0] + '_' + AgentDetails[1] + ')'

      };

      var runId = null;
      var result = null;

      api.addPlanEntry(this.PlanID, rundetails, function (err, response, run) {

        if (err !== 'null') {
          runId = run.runs[0].id;
          _this3.newline().write('------------------------------------------------------').newline().write(_this3.chalk.green('Run added successfully.')).newline().write(_this3.chalk.blue.bold('Run name   ')).write(_this3.chalk.yellow('Run_' + _this3.creationDate + '(' + AgentDetails[0] + '_' + AgentDetails[1] + ')'));

          result = {
            results: resultsTestcases
          };

          api.addResultsForCases(runId, result, function (err1, response1, results) {
            if (err1 === 'null')
              _this3.newline().write(_this3.chalk.blue('---------Error at Add result -----')).newline().write(err1);
            else if (results.length === 0)
              _this3.newline().write(_this3.chalk.red('No Data has been published to Testrail.')).newline().write(err1);
            else
              _this3.newline().write('------------------------------------------------------').newline().write(_this3.chalk.green('Result added to the testrail Successfully'));

          });
        }
        else
          _this3.newline().write(_this3.chalk.blue('-------------Error at AddPlanEntry ----------------')).newline().write(err);

      });
    },

    getProject: function getProject (api) {
      var _this4 = this;

      api.getProjects(function (err, response, project) {
        if (err !== 'null' && typeof project !== 'undefined') {

          project.forEach(function (aProject) {
            if (aProject.name === String(_this4.ProjectName)) {
              _this4.ProjectID = aProject.id;
              _this4.newline().write(_this4.chalk.blue.bold('Project name(id) ')).write(_this4.chalk.yellow(_this4.ProjectName + '(' + aProject.id + ')'));
            }
          });
        }
        else {
          _this4.newline().write(_this4.chalk.blue('-------------Error at Get Projects  ----------------')).newline();
          console.log(err);

          _this4.ProjectID = 0;
        }
      });
    },

    getPlanID: function getPlanID (api) {
      var _this5 = this;

      api.getPlans(this.ProjectID, function (err, response, plan) {
        var planid = '';

        if (err !== 'null') {

          for (var index in plan) {
            if (plan[index].name === _this5.PlanName) {
              _this5.newline().write(_this5.chalk.blue.bold('Plan name(id) ')).write(_this5.chalk.yellow(plan[index].name + '(' + plan[index].id + ')'));
              planid = plan[index].id;
              break;
            }
          }

          if (planid === '')
            _this5.addNewPlan(api);
          else
            _this5.PlanID = planid;

        }
        else {
          _this5.newline().write(_this5.chalk.blue('-------------Error at Get Plans  ----------------')).newline();
          console.log(err);
          _this5.PlanID = 0;
        }
      });
    },
    addNewPlan: function addNewPlan (api) {
      var _this6 = this;

      api.addPlan(this.ProjectID, { name: this.PlanName, desription: 'Added From Automation reporter plugin' }, function (err, response, plan) {
        if (err !== 'null') {
          if (typeof plan.id === 'undefined') {
            _this6.newline().write(_this6.chalk.red('Plan Id found as undefined'));
            _this6.PlanID = 0;
          }
          else {
            _this6.newline().write(_this6.chalk.green('New Plan is created')).newline().write(_this6.chalk.blue.bold('Plan name(id) ')).write(_this6.chalk.yellow(plan.name + '(' + plan.id + ')'));
            _this6.PlanID = plan.id;
          }
        }
        else {
          _this6.newline().write(_this6.chalk.blue('-------------Error at Add New Plan  ----------------')).newline();
          console.log(err);

          _this6.PlanID = 0;
        }
      });
    },

    getSuiteID: function getSuiteID (api) {
      var _this7 = this;

      return api.getSuites(this.ProjectID, function (err, response, suites) {
        if (err !== 'null') {

          if (suites.length === 0) {
            _this7.newline().write(_this7.chalk.red('The project doesnt contain any suite'));
            _this7.SuiteID = 0;
          }
          else {

            var id = suites[0].id;

            _this7.newline().write(_this7.chalk.blue.bold('Suite name(id) ')).write(_this7.chalk.yellow(suites[0].name + '(' + id + ')'));
            _this7.SuiteID = id;
          }
        }
        else {
          _this7.newline().write(_this7.chalk.blue('-------------Error at Get Suites  ----------------')).newline();
          console.log(err);
          _this7.SuiteID = 0;
        }
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
