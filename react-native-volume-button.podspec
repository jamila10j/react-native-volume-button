require "json"

package = JSON.parse(File.read(File.join(__dir__, "package.json")))

Pod::Spec.new do |s|
  s.name         = "react-native-volume-button"
  s.version      = package["version"]
  s.summary      = package["description"]
  s.homepage     = "https://github.com/yourusername/react-native-volume-button"
  s.license      = "MIT"
  s.authors      = package["author"]

  s.platforms    = { :ios => "10.0" }
  s.source       = { :git => "https://github.com/yourusername/react-native-volume-button.git", :tag => "#{s.version}" }

  s.source_files = "ios/**/*.{h,m,mm,swift}"
  s.requires_arc = true

  s.dependency "React-Core"
end