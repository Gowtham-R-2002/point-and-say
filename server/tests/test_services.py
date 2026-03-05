"""
Tests for Point & Say UI Backend Services
"""
import os
import sys
import json
import pytest

# Add server directory to path
SERVER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROJECT_ROOT = os.path.dirname(SERVER_DIR)
sys.path.insert(0, SERVER_DIR)



# ========== Scanner Tests ==========

class TestScanner:
    """Tests for the project scanner service."""

    def test_scan_project_builtin(self):
        """Scan the built-in dashboard project."""
        from services.scanner import scan_project

        result = scan_project(PROJECT_ROOT)

        assert result["framework"] == "React (Vite)"
        assert result["totalFiles"] > 0
        assert len(result["components"]) > 0
        assert "error" not in result

    def test_scan_detects_components(self):
        """Scanner finds expected component files."""
        from services.scanner import scan_project

        result = scan_project(PROJECT_ROOT)

        comp_names = [c["name"] for c in result["components"]]
        assert "Sidebar" in comp_names
        assert "HeroSection" in comp_names
        assert "StatsCards" in comp_names
        assert "AnalyticsChart" in comp_names

    def test_scan_detects_data_attributes(self):
        """Scanner finds data-component attributes in source files."""
        from services.scanner import scan_project

        result = scan_project(PROJECT_ROOT)

        # At least some components should have data-component attributes
        components_with_attrs = [c for c in result["components"] if c["dataAttributes"]]
        assert len(components_with_attrs) > 0

    def test_scan_external_project(self):
        """Scanner works with external projects (nexus-dashboard)."""
        from services.scanner import scan_project

        nexus_path = os.path.expanduser(
            "~/Desktop/nexus-dashboard/nexus-analytics-dashboard/target-app"
        )

        if not os.path.isdir(nexus_path):
            pytest.skip("nexus-dashboard not found")

        result = scan_project(nexus_path)

        assert result["framework"] == "React (Vite)"
        assert result["totalFiles"] >= 8  # nexus has 10 component files
        assert "error" not in result

        comp_names = [c["name"] for c in result["components"]]
        assert "HeroBanner" in comp_names or "RevenueChart" in comp_names

    def test_scan_element_types(self):
        """Scanner correctly classifies element types."""
        from services.scanner import scan_project

        result = scan_project(PROJECT_ROOT)

        type_map = {c["name"]: c["elementType"] for c in result["components"]}

        # Check known types
        if "Sidebar" in type_map:
            assert type_map["Sidebar"] == "navigation"
        if "HeroSection" in type_map:
            assert type_map["HeroSection"] == "section"
        if "AnalyticsChart" in type_map:
            assert type_map["AnalyticsChart"] == "chart"
        if "DataTable" in type_map:
            assert type_map["DataTable"] == "table"

    def test_scan_nonexistent_directory(self):
        """Scanner handles nonexistent directories gracefully."""
        from services.scanner import scan_project

        result = scan_project("/nonexistent/path/to/nowhere")
        assert "error" in result

    def test_scan_skips_excluded_files(self):
        """Scanner skips main.tsx, index.tsx, App.tsx etc."""
        from services.scanner import scan_project

        result = scan_project(PROJECT_ROOT)

        comp_names = [c["name"] for c in result["components"]]
        assert "main" not in comp_names
        assert "index" not in comp_names


# ========== CodeGen Tests ==========

class TestCodeGen:
    """Tests for the code generation service."""

    def test_parse_nova_json_clean(self):
        """parse_nova_json handles clean JSON."""
        from services.codegen import parse_nova_json

        valid_json = '{"modifiedCode": "const x = 1;", "explanation": "Changed x"}'
        result = parse_nova_json(valid_json)
        assert result["modifiedCode"] == "const x = 1;"
        assert result["explanation"] == "Changed x"

    def test_parse_nova_json_markdown_wrapped(self):
        """parse_nova_json strips markdown code blocks."""
        from services.codegen import parse_nova_json

        wrapped = '```json\n{"modifiedCode": "const x = 1;", "explanation": "Done"}\n```'
        result = parse_nova_json(wrapped)
        assert result["modifiedCode"] == "const x = 1;"

    def test_parse_nova_json_invalid_escapes(self):
        """parse_nova_json handles Nova's invalid escape sequences."""
        from services.codegen import parse_nova_json

        # Nova sometimes produces \\` and \\$ which aren't valid JSON escapes
        bad_json = '{"modifiedCode": "const x = \\\\`hello\\\\`", "explanation": "Added template"}'
        result = parse_nova_json(bad_json)
        assert "hello" in result["modifiedCode"]

    def test_mock_codegen_color_change(self):
        """Mock codegen handles color change requests."""
        from services.codegen import generate_code_change_mock

        result = generate_code_change_mock(
            component_name="Button",
            file_path="src/Button.tsx",
            source_code='<button style={{color: "#fb8c66"}}>Click</button>',
            intent="make this button blue",
        )

        assert result["mock"] is True
        assert "blue" in result["explanation"].lower()

    def test_detect_styling_approach(self):
        """Styling detection works for different approaches."""
        from services.codegen import _detect_styling_approach

        tailwind_code = '<div className="flex items-center gap-2 rounded-xl p-4">'
        assert _detect_styling_approach(tailwind_code) == "tailwind"

        mui_code = '<Box sx={{ display: "flex" }}>Hello</Box>'
        assert _detect_styling_approach(mui_code) == "mui"

        css_vars_code = '<div style={{ color: "var(--text-primary)" }}>Hello</div>'
        assert _detect_styling_approach(css_vars_code) == "css-vars"


# ========== Verification Tests ==========

class TestVerification:
    """Tests for the verification service."""

    def test_mock_verify(self):
        """Mock verification returns expected structure."""
        from services.verification import _mock_verify

        result = _mock_verify("Changed button color to blue", "ActionButton")
        assert result["verified"] is True
        assert result["method"] == "mock"
        assert result["mock"] is True
        assert "ActionButton" in result["reason"]

    def test_verify_fallback_to_mock(self):
        """Verification falls back to mock when no AI is available."""
        from services.verification import verify_change

        # Without AWS credentials or screenshot, should fall back to mock
        result = verify_change(
            expected_change="Changed text to Hello",
            component_name="TestComponent",
        )

        assert "verified" in result
        assert "method" in result
        assert "reason" in result


# ========== API Integration Tests ==========

class TestAPIStructure:
    """Tests for API request/response models."""

    def test_configure_request_model(self):
        """ConfigureRequest has expected fields."""
        # Import FastAPI app to test models
        from main import ConfigureRequest

        req = ConfigureRequest(projectPath="/tmp/test")
        assert req.projectPath == "/tmp/test"
        assert req.devServerUrl == "http://localhost:5173"  # default

    def test_generate_request_model(self):
        """GenerateRequest has expected fields."""
        from main import GenerateRequest

        req = GenerateRequest(
            componentName="Button",
            filePath="src/Button.tsx",
            intent="make it blue",
            targetElement="CTA button",
        )
        assert req.componentName == "Button"
        assert req.targetElement == "CTA button"

    def test_verify_request_model(self):
        """VerifyRequest has expected fields and defaults."""
        from main import VerifyRequest

        req = VerifyRequest(expectedChange="color change")
        assert req.expectedChange == "color change"
        assert req.appUrl == "http://localhost:5173"
        assert req.componentName == ""


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
